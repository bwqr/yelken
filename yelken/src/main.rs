use std::time::Instant;

use axum::{
    extract::Request,
    http::{self, HeaderValue},
    middleware::Next,
    response::Response,
    Extension, Router,
};
use base::{config::Config, crypto::Crypto, schema::locales, types::Pool, AppState};
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
    dotenvy::from_path("./.env").ok();

    env_logger::init();

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

    #[cfg(feature = "admin")]
    let app = app.nest("/api/admin", admin::router(state.clone()));

    #[cfg(feature = "app")]
    let app = app.nest(
        "/yk/app",
        app_server::router(state.clone(), &server_config.app_assets_dir),
    );
    #[cfg(feature = "app")]
    let app = app.nest_service(
        "/assets/yelken",
        ServeDir::new(server_config.app_assets_dir),
    );

    #[cfg(feature = "auth")]
    let app = app.nest("/api/auth", auth::router());

    #[cfg(feature = "content")]
    let app = app.nest("/api/content", content::router(state.clone()));

    #[cfg(feature = "form")]
    let app = app.nest("/yk/form", form::router());

    #[cfg(feature = "plugin")]
    let (app, layers, plugin_host) = {
        let plugin_host = plugin::PluginHost::new(
            &format!("{storage_dir}/plugins"),
            state.pool.get().await.unwrap(),
        )
        .await
        .unwrap();

        (
            app.nest("/api/plugin", plugin::router(state.clone())),
            layers.layer(Extension(plugin_host.clone())),
            plugin_host,
        )
    };

    #[cfg(feature = "ui")]
    let (app, layers) = {
        use diesel::prelude::*;
        use diesel_async::RunQueryDsl;
        use std::sync::Arc;
        use unic_langid::LanguageIdentifier;

        let locales = locales::table
            .select(locales::key)
            .filter(locales::disabled.eq(false))
            .load::<String>(&mut state.pool.get().await.unwrap())
            .await
            .unwrap()
            .into_iter()
            .flat_map(|key| {
                key.parse()
                    .inspect_err(|e| log::warn!("Failed to parse locale {key} due to {e:?}"))
                    .ok()
            })
            .collect::<Arc<[LanguageIdentifier]>>();

        let default_locale = locales.get(0).cloned().unwrap_or_else(|| {
            log::error!("Either there is no locale in database or an invalid one exists, using default locale \"en\"");

            "en".parse().unwrap()
        });

        let l10n = ui::build_l10n(
            locales,
            default_locale,
            &[
                // Theme provided localizations
                format!(
                    "{}/themes/{}/locales",
                    state.config.storage_dir, state.config.theme
                ),
                // Global scoped, user provided localizations
                format!("{}/locales/global", state.config.storage_dir),
                // Theme scoped, user provided localizations
                format!(
                    "{}/locales/themes/{}",
                    state.config.storage_dir, state.config.theme
                ),
            ],
        )
        .await;

        #[cfg(feature = "plugin")]
        let resources = (l10n.clone(), state.pool.clone(), plugin_host);
        #[cfg(not(feature = "plugin"))]
        let resources = (l10n.clone(), state.pool.clone());

        let render = ui::build_render(
            &[
                // Theme provided templates
                format!(
                    "{}/themes/{}/templates",
                    state.config.storage_dir, state.config.theme
                ),
                // Global scoped, user provided templates
                format!("{}/templates/global", state.config.storage_dir),
                // Theme scoped, user provided templates
                format!(
                    "{}/templates/themes/{}",
                    state.config.storage_dir, state.config.theme
                ),
            ],
            resources,
        );

        (
            app.nest("/api/ui", ui::router(state.clone()))
                .fallback(ui::serve_page),
            layers.layer(Extension(l10n)).layer(Extension(render)),
        )
    };

    #[cfg(feature = "user")]
    let app = app.nest("/api/user", user::router(state.clone()));

    let app = app
        .with_state(state)
        .layer(layers.layer(axum::middleware::from_fn(logger)));

    let listener = tokio::net::TcpListener::bind(server_config.address)
        .await
        .unwrap();

    axum::serve(listener, app).await.unwrap();
}
