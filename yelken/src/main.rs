use std::time::Instant;

use anyhow::Context;
use axum::{
    extract::Request,
    http::{self, HeaderValue},
    middleware::Next,
    response::Response,
    Extension, Router,
};
use base::{config::Config, crypto::Crypto, types::Pool, AppState};
use config::ServerConfig;
use diesel_async::{
    pooled_connection::{bb8, AsyncDieselConnectionManager},
    AsyncPgConnection,
};
use plugin::PluginHost;
use tower::ServiceBuilder;
use tower_http::{cors::CorsLayer, services::ServeDir};

mod config;
mod handlers;

async fn logger(req: Request, next: Next) -> Response {
    let path = req.uri().path().to_owned();

    let start = Instant::now();

    let res = next.run(req).await;

    log::info!(
        "{:?} - {} - {}",
        path,
        res.status(),
        Instant::now().duration_since(start).as_secs_f32()
    );

    res
}

#[tokio::main]
async fn main() {
    env_logger::builder().parse_filters("info").init();

    dotenvy::from_path("./.env")
        .context("could not load environment variables from file ./.env")
        .unwrap();

    let config = Config::from_env().unwrap();
    let storage_dir = config.storage_dir.clone();

    let server_config = ServerConfig::from_env().unwrap();

    let db_config =
        AsyncDieselConnectionManager::<AsyncPgConnection>::new(&server_config.database_url);
    let pool: Pool = bb8::Pool::builder().build(db_config).await.unwrap();

    let plugin_host = {
        let conn = pool.get().await.unwrap();

        PluginHost::new(&format!("{}/plugins", storage_dir), conn)
            .await
            .unwrap()
    };

    let crypto = Crypto::new(
        std::env::var("YELKEN_SECRET_KEY")
            .expect("YELKEN_SECRET_KEY is not provided in env")
            .as_str(),
    );

    let cors = CorsLayer::new()
        .allow_methods([
            http::Method::GET,
            http::Method::POST,
            http::Method::PUT,
            http::Method::DELETE,
        ])
        .allow_headers([http::header::AUTHORIZATION, http::header::CONTENT_TYPE])
        .allow_origin(config.web_origin.parse::<HeaderValue>().unwrap());

    let state = AppState::new(config, pool);

    let app = Router::new()
        .nest("/api/auth", auth::router())
        .nest("/api/content", content::router(state.clone()))
        .nest("/api/plugin", plugin::router(state.clone()))
        .nest("/api/user", user::router(state.clone()))
        .nest(
            &format!("{}/", state.config.app_root),
            management::router(state.clone()),
        )
        .nest_service("/assets/static", ServeDir::new(format!("{}/assets", storage_dir)))
        .nest_service("/assets/content", ServeDir::new(format!("{}/content", storage_dir)))
        .fallback(handlers::default_handler)
        .with_state(state)
        .layer(
            ServiceBuilder::new()
                .layer(Extension(plugin_host))
                .layer(cors)
                .layer(Extension(crypto))
                .layer(axum::middleware::from_fn(logger)),
        );

    let listener = tokio::net::TcpListener::bind(server_config.address)
        .await
        .unwrap();

    axum::serve(listener, app).await.unwrap();
}
