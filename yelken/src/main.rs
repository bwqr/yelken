use std::{collections::HashMap, sync::Arc, time::Instant};

use anyhow::Context;
use axum::{
    extract::Request,
    http::{self, HeaderValue},
    middleware::Next,
    response::Response,
    Extension, Router,
};
use base::{
    config::Config,
    crypto::Crypto,
    schema::locales,
    types::{Connection, Pool},
    AppState,
};
use config::ServerConfig;
use diesel::prelude::*;
use diesel_async::{
    pooled_connection::{bb8, AsyncDieselConnectionManager},
    AsyncPgConnection, RunQueryDsl,
};
use fluent::{concurrent::FluentBundle, FluentResource};
use locale::Locale;
use render::Render;
use plugin::PluginHost;
use tower::ServiceBuilder;
use tower_http::{cors::CorsLayer, services::ServeDir};
use unic_langid::LanguageIdentifier;

mod config;
mod handlers;
mod locale;
mod render;

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

async fn build_locale(mut conn: Connection<'_>, storage_dir: &str, theme: &str) -> Locale {
    let locales = locales::table
        .select(locales::key)
        .load::<String>(&mut conn)
        .await
        .unwrap();

    let default: LanguageIdentifier = match locales.get(0).map(|locale| locale.parse()) {
        Some(Ok(locale)) => locale,
        _ => {
            log::warn!("Either there is no locale in database or an invalid one exists, using default locale \"en\"");

            "en".parse().unwrap()
        }
    };

    let supported_locales: Arc<[LanguageIdentifier]> = locales
        .into_iter()
        .flat_map(|locale| {
            locale
                .parse()
                .inspect_err(|e| log::warn!("Failed to parse locale {locale} due to {e:?}"))
                .ok()
        })
        .collect();

    let locales_dir = format!("{}/themes/{}/locales", storage_dir, theme);

    let bundles = HashMap::from_iter(supported_locales.iter().cloned().map(|id| {
        let mut bundle = FluentBundle::new_concurrent(vec![id.clone(), default.clone()]);

        let resource = FluentResource::try_new(
            std::fs::read_to_string(format!("{locales_dir}/{id}.ftl")).unwrap(),
        )
        .unwrap();

        if let Err(e) = bundle.add_resource(resource) {
            log::warn!("Failed to add resource to localization bundle, {e:?}");
        }

        (id, bundle)
    }));

    Locale::new(supported_locales, default, bundles)
}

async fn build_plugin_host(mut conn: Connection<'_>, storage_dir: &str) -> PluginHost {
    PluginHost::new(&format!("{storage_dir}/plugins", conn))
        .await
        .unwrap()
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

    let plugin_host = build_plugin_host(pool.get().await.unwrap(), storage_dir).await;

    let locale = build_locale(
        pool.get().await.unwrap(),
        &config.storage_dir,
        &config.theme,
    )
    .await;

    let render = Render::from_dir(
        &format!("{}/themes/{}/templates", config.storage_dir, config.theme),
        Some((locale.clone(), pool.clone())),
    )
    .unwrap();

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
        .nest_service(
            "/assets/static",
            ServeDir::new(format!("{}/assets", storage_dir)),
        )
        .nest_service(
            "/assets/content",
            ServeDir::new(format!("{}/content", storage_dir)),
        )
        .fallback(handlers::serve_page)
        .with_state(state)
        .layer(
            ServiceBuilder::new()
                .layer(Extension(plugin_host))
                .layer(cors)
                .layer(Extension(crypto))
                .layer(Extension(locale))
                .layer(Extension(render))
                .layer(axum::middleware::from_fn(logger)),
        );

    let listener = tokio::net::TcpListener::bind(server_config.address)
        .await
        .unwrap();

    axum::serve(listener, app).await.unwrap();
}
