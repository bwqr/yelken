use std::{ops::Deref, sync::Arc};

use anyhow::Context;
use axum::{extract::Request, middleware::Next, response::Response, routing::get, Router};
use config::{Config, ServerConfig};
use tower::ServiceBuilder;
use tower_http::services::ServeDir;
use plugin::PluginHost;

mod admin;
mod config;

#[derive(Clone)]
pub struct AppState(Arc<InnerState>);

pub struct InnerState {
    config: Config,
    plugin_host: PluginHost,
}

impl Deref for AppState {
    type Target = InnerState;

    fn deref(&self) -> &Self::Target {
        &*self.0
    }
}

async fn logger(req: Request, next: Next) -> Response {
    let path = req.uri().path().to_owned();

    let res = next.run(req).await;

    log::info!("{:?} - {}", path, res.status());

    res
}

#[tokio::main]
async fn main() {
    env_logger::builder().parse_filters("info").init();

    dotenvy::from_path("./.env")
        .context("could load environment variables from file ./.env")
        .unwrap();

    let config = Config::from_env().unwrap();
    let storage_dir = config.storage_dir.clone();

    let server_config = ServerConfig::from_env().unwrap();

    let plugin_host = PluginHost::new(&format!("{}/plugins", storage_dir))
        .await
        .unwrap();

    let state = AppState(Arc::new(InnerState {
        config,
        plugin_host,
    }));

    let app = Router::new()
        .route("/", get(root))
        .nest("/admin", admin::router(state.clone()))
        .with_state(state)
        .nest_service(
            "/assets/plugins",
            ServeDir::new(format!("{}/assets/plugins", storage_dir)),
        )
        .layer(ServiceBuilder::new().layer(axum::middleware::from_fn(logger)));

    let listener = tokio::net::TcpListener::bind(server_config.address).await.unwrap();

    axum::serve(listener, app).await.unwrap();
}

async fn root() -> &'static str {
    "Hello, World!"
}
