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

pub struct DatabaseConfig {
    pub url: String,
}

async fn load_options(mut conn: PooledConnection) -> Options {
    let option_values = options::table
        .filter(options::namespace.is_null())
        .filter(options::name.eq_any(&["theme", "default_locale"]))
        .select((options::name, options::value))
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
        .allow_origin(
            config
                .app_url
                .origin()
                .ascii_serialization()
                .parse::<HeaderValue>()
                .unwrap(),
        );

    let state = AppState::new(config, pool, storage.clone(), tmp_storage);

    let layers = ServiceBuilder::new()
        .layer(cors)
        .layer(Extension(crypto))
        .layer(Extension(options.clone()));

    let base_path = state.config.site_url.path().to_string();

    let app = Router::new()
        .nest_service(
            "/assets/static",
            ServeStorageDir::new(storage.clone(), "assets".into()),
        )
        .nest_service(
            "/assets/content",
            ServeStorageDir::new(storage.clone(), "content".into()),
        );

    #[cfg(feature = "admin")]
    let app = app.nest("/api/admin", admin::router(state.clone()));

    #[cfg(feature = "app")]
    let app = app.nest("/yk/app/", app::router(app_assets_storage, &base_path));

    #[cfg(feature = "app")]
    let app = app.route(
        "/yk/app",
        axum::routing::get((
            axum::http::StatusCode::PERMANENT_REDIRECT,
            [(
                axum::http::header::LOCATION,
                axum::http::HeaderValue::from_str(&format!("{base_path}/yk/app/")).unwrap(),
            )],
        )),
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
            &format!("{}/plugins", server_config.storage_dir),
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
        let l10n = ui::L10n::new(
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

        let render = ui::Render::new(
            &storage,
            &options.template_locations(),
            Some(resources.clone()),
        )
        .await
        .inspect_err(|e| log::error!("Failed to initialize Render, using an empty instance, {e:?}"))
        .unwrap_or_else(|_| ui::Render::empty(Some(resources)));

        (
            app.nest("/api/ui", ui::router(state.clone()))
                .fallback(ui::serve_page),
            layers.layer(Extension(l10n)).layer(Extension(render)),
        )
    };

    #[cfg(feature = "user")]
    let app = app.nest("/api/user", user::router(state.clone()));

    let app = app.with_state(state).layer(layers);

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
