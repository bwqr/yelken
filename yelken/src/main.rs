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
use tower::ServiceBuilder;
use tower_http::{cors::CorsLayer, services::ServeDir};

mod config;

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

    let layers = ServiceBuilder::new().layer(cors).layer(Extension(crypto));

    let app = Router::new()
        .nest_service(
            "/assets/static",
            ServeDir::new(format!("{}/assets", storage_dir)),
        )
        .nest_service(
            "/assets/content",
            ServeDir::new(format!("{}/content", storage_dir)),
        );

    let app = {
        #[cfg(feature = "app")]
        {
            app.nest("/yk/app", app_server::router(state.clone()))
        }
        #[cfg(not(feature = "app"))]
        {
            app
        }
    };

    let app = {
        #[cfg(feature = "auth")]
        {
            app.nest("/api/auth", auth::router())
        }
        #[cfg(not(feature = "auth"))]
        {
            app
        }
    };

    let app = {
        #[cfg(feature = "content")]
        {
            app.nest("/api/content", content::router(state.clone()))
        }
        #[cfg(not(feature = "content"))]
        {
            app
        }
    };

    let (app, layers) = {
        #[cfg(feature = "plugin")]
        {
            let plugin_host = plugin::PluginHost::new(
                &format!("{storage_dir}/plugins"),
                state.pool.get().await.unwrap(),
            )
            .await
            .unwrap();

            (
                app.nest("/api/plugin", plugin::router(state.clone())),
                layers.layer(Extension(plugin_host)),
            )
        }
        #[cfg(not(feature = "plugin"))]
        {
            (app, layers)
        }
    };

    let (app, layers) = {
        #[cfg(feature = "ui")]
        {
            let l10n = ui::build_locale(
                &format!(
                    "{}/themes/{}/locales",
                    state.config.storage_dir, state.config.theme
                ),
                state.pool.get().await.unwrap(),
            )
            .await;

            let render = ui::build_render(
                &format!(
                    "{}/themes/{}/templates",
                    state.config.storage_dir, state.config.theme
                ),
                l10n.clone(),
                state.pool.clone(),
            );

            (
                app.fallback(ui::serve_page),
                layers.layer(Extension(l10n)).layer(Extension(render)),
            )
        }
        #[cfg(not(feature = "ui"))]
        {
            (app, layers)
        }
    };

    let app = {
        #[cfg(feature = "user")]
        {
            app.nest("/api/user", user::router(state.clone()))
        }
        #[cfg(not(feature = "user"))]
        {
            app
        }
    };

    let app = app
        .with_state(state)
        .layer(layers.layer(axum::middleware::from_fn(logger)));

    let listener = tokio::net::TcpListener::bind(server_config.address)
        .await
        .unwrap();

    axum::serve(listener, app).await.unwrap();
}
