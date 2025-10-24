use std::sync::Arc;

use axum::{
    Extension, Router,
    http::{self, HeaderValue},
};
use base::{
    AppState,
    config::{Config, Options},
    crypto::Crypto,
    db::{Pool, PooledConnection},
    schema::options,
    services::ServeStorageDir,
};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use opendal::Operator;
use tower::ServiceBuilder;
use tower_http::cors::CorsLayer;

mod health;

pub struct DatabaseConfig {
    pub url: String,
}

async fn load_options(mut conn: PooledConnection) -> Options {
    let option_values = options::table
        .filter(options::namespace.is_null())
        .filter(options::key.eq_any(&["theme", "default_locale"]))
        .select((options::key, options::value))
        .load::<(String, String)>(&mut conn)
        .await
        .unwrap();

    let theme: Arc<str> = match option_values.iter().find(|opt| opt.0 == "theme") {
        Some((_, theme)) => Into::<Arc<str>>::into(theme.as_str()),
        None => {
            log::warn!("No value found for \"theme\" option, using default \"yelken.default\"");

            "yelken.default".into()
        }
    };

    let default_locale = match option_values
        .iter()
        .find(|opt| opt.0 == "default_locale")
        .and_then(|opt| opt.1.parse().ok())
    {
        Some(default_locale) => default_locale,
        None => {
            log::warn!(
                "No value or an invalid one found for \"default_locale\" option, using default \"en\""
            );

            "en".parse().unwrap()
        }
    };

    let locales = Options::load_locales(&mut conn).await.unwrap();

    Options::new(theme, locales, default_locale)
}

pub async fn router(
    crypto: Crypto,
    config: Config,
    pool: Pool,
    storage: Operator,
    app_assets_storage: Operator,
    tmp_storage: Operator,
    cors_origins: Vec<HeaderValue>,
) -> Router<()> {
    let options = load_options(pool.get().await.unwrap()).await;

    let cors = CorsLayer::new()
        .allow_methods([
            http::Method::GET,
            http::Method::POST,
            http::Method::PUT,
            http::Method::DELETE,
        ])
        .allow_headers([http::header::AUTHORIZATION, http::header::CONTENT_TYPE])
        .allow_origin(cors_origins);

    let state = AppState::new(config, pool, storage.clone(), tmp_storage);

    let layers = ServiceBuilder::new()
        .layer(cors)
        .layer(Extension(crypto))
        .layer(Extension(options.clone()));

    let api = Router::new()
        .nest("/common", common::router(state.clone()))
        .nest("/health", health::router());

    #[cfg(feature = "admin")]
    let api = api.nest("/admin", admin::router(state.clone()));

    #[cfg(feature = "appearance")]
    let api = api.nest("/appearance", appearance::router(state.clone()));

    #[cfg(feature = "auth")]
    let api = api.nest("/auth", auth::router());

    #[cfg(feature = "cms")]
    let api = api.nest("/cms", cms::router(state.clone()));

    #[cfg(feature = "user")]
    let api = api.nest("/user", user::router(state.clone()));

    #[cfg(feature = "plugin")]
    let (api, layers, plugin_host) = {
        let plugin_host = plugin::PluginHost::new(
            &format!("{}/plugins", server_config.storage_dir),
            state.pool.get().await.unwrap(),
        )
        .await
        .unwrap();

        (
            api.nest("/plugin", plugin::router(state.clone())),
            layers.layer(Extension(plugin_host.clone())),
            plugin_host,
        )
    };

    let app = Router::new().nest_service(
        "/assets/content",
        ServeStorageDir::new(storage.clone(), || "assets".to_string()),
    );

    let app = {
        let options = options.clone();

        app.nest_service(
            "/assets/theme",
            ServeStorageDir::new(storage.clone(), move || {
                format!("themes/{}/assets", options.theme())
            }),
        )
    };

    #[cfg(feature = "app")]
    let app = app.nest(
        "/yk/app/",
        app::router(app_assets_storage, state.config.site_url.clone()),
    );

    #[cfg(feature = "app")]
    let app = {
        let mut redirect_url = state.config.site_url.clone();

        redirect_url
            .path_segments_mut()
            .unwrap()
            .pop_if_empty()
            .push("yk")
            .push("app")
            .push("");

        app.route(
            "/yk/app",
            axum::routing::get((
                axum::http::StatusCode::PERMANENT_REDIRECT,
                [(
                    axum::http::header::LOCATION,
                    axum::http::HeaderValue::from_str(redirect_url.as_str()).unwrap(),
                )],
            )),
        )
    };

    #[cfg(feature = "cms")]
    let app = app.nest("/yk/form", cms::form_router());

    #[cfg(feature = "appearance")]
    let (app, layers) = {
        let l10n = appearance::L10n::new(
            &storage,
            &options.locale_locations(),
            &options.locales(),
            options.default_locale(),
        )
        .await;

        #[cfg(feature = "plugin")]
        let resources = (l10n.clone(), state.pool.clone(), plugin_host);
        #[cfg(not(feature = "plugin"))]
        let resources = (l10n.clone(), state.pool.clone());

        let render = appearance::Render::new(
            &storage,
            &options.template_locations(),
            Some(resources.clone()),
        )
        .await
        .inspect_err(|e| log::error!("Failed to initialize Render, using an empty instance, {e:?}"))
        .unwrap_or_else(|_| appearance::Render::empty(Some(resources)));

        (
            app.fallback(appearance::serve_page),
            layers.layer(Extension(l10n)).layer(Extension(render)),
        )
    };

    let base_path = state.config.site_url.path().to_string();

    let app = app
        .nest("/api", api.fallback(axum::http::StatusCode::NOT_FOUND))
        .with_state(state)
        .layer(layers);

    if base_path == "/" {
        return app;
    }

    Router::new()
        .route(
            &base_path,
            axum::routing::get((
                axum::http::StatusCode::PERMANENT_REDIRECT,
                [(
                    axum::http::header::LOCATION,
                    axum::http::HeaderValue::from_str(&format!("{base_path}/")).unwrap(),
                )],
            )),
        )
        .nest(&format!("{base_path}/"), app)
}
