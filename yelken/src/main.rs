use std::{sync::Arc, time::Instant};

use axum::{
    extract::Request,
    http::{self, HeaderValue},
    middleware::Next,
    response::Response,
    Extension, Router,
};
use base::{
    config::{Config, Options},
    crypto::Crypto,
    schema::options,
    types::{Connection, Pool},
    AppState,
};
use config::{DatabaseConfig, ServerConfig};
use diesel::prelude::*;
use diesel_async::{
    pooled_connection::{bb8, AsyncDieselConnectionManager},
    AsyncPgConnection, RunQueryDsl,
};
use opendal::{services, Operator};
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

async fn load_options<'a>(mut conn: Connection<'a>) -> Options {
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
            log::warn!("No value or an invalid one found for \"default_locale\" option, using default \"en\"");

            "en".parse().unwrap()
        }
    };

    let locales = Options::load_locales(&mut conn).await.unwrap();

    Options::new(theme, locales, default_locale)
}

#[tokio::main]
async fn main() {
    dotenvy::from_path("./.env").ok();

    env_logger::init();

    let command = std::env::args().nth(1).unwrap_or("".to_string());

    if command == "migrate" || command == "migrate-run" {
        let db_config = DatabaseConfig::from_env().unwrap();

        setup::migrate(
            &mut <diesel::PgConnection as diesel::Connection>::establish(&db_config.url).unwrap(),
        )
        .unwrap();

        if command != "migrate-run" {
            return;
        }
    }

    let db_config = DatabaseConfig::from_env().unwrap();
    let config = Config::from_env().unwrap();
    let server_config = ServerConfig::from_env().unwrap();

    let storage = {
        let builder = services::Fs::default().root(&server_config.storage_dir);

        Operator::new(builder).unwrap().finish()
    };

    let db_config = AsyncDieselConnectionManager::<AsyncPgConnection>::new(&db_config.url);
    let pool: Pool = bb8::Pool::builder().build(db_config).await.unwrap();

    let crypto = Crypto::new(
        std::env::var("YELKEN_SECRET_KEY")
            .expect("YELKEN_SECRET_KEY is not provided in env")
            .as_str(),
    );

    let options = load_options(pool.get().await.unwrap()).await;

    let cors = CorsLayer::new()
        .allow_methods([
            http::Method::GET,
            http::Method::POST,
            http::Method::PUT,
            http::Method::DELETE,
        ])
        .allow_headers([http::header::AUTHORIZATION, http::header::CONTENT_TYPE])
        .allow_origin(config.frontend_origin.parse::<HeaderValue>().unwrap());

    let state = AppState::new(config, pool, storage.clone());

    let layers = ServiceBuilder::new()
        .layer(cors)
        .layer(Extension(crypto))
        .layer(Extension(options.clone()));

    let app = Router::new()
        .nest_service(
            "/assets/static",
            ServeDir::new(format!("{}/assets", server_config.storage_dir)),
        )
        .nest_service(
            "/assets/content",
            ServeDir::new(format!("{}/content", server_config.storage_dir)),
        );

    #[cfg(feature = "admin")]
    let app = app.nest("/api/admin", admin::router(state.clone()));

    #[cfg(feature = "app")]
    let app = app.nest(
        "/yk/app/",
        app::router(&state.config.backend_origin, &server_config.app_assets_dir),
    );

    #[cfg(feature = "app")]
    let app = app.route(
        "/yk/app",
        axum::routing::get((
            axum::http::StatusCode::PERMANENT_REDIRECT,
            [(
                axum::http::header::LOCATION,
                axum::http::HeaderValue::from_static("/yk/app/"),
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

    let app = app
        .with_state(state)
        .layer(layers.layer(axum::middleware::from_fn(logger)));

    let listener = tokio::net::TcpListener::bind(server_config.address)
        .await
        .unwrap();

    axum::serve(listener, app).await.unwrap();
}
