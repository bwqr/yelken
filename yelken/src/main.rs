use std::{net::SocketAddrV4, time::Instant};

use anyhow::{Context, Result};
use axum::{extract::Request, middleware::Next, response::Response};
use base::{
    config::Config,
    crypto::Crypto,
    types::{Connection, SyncConnection},
};
use diesel_async::pooled_connection::{AsyncDieselConnectionManager, deadpool};
use yelken::DatabaseConfig;

pub struct ServerConfig {
    pub address: SocketAddrV4,
    pub app_assets_dir: String,
    pub storage_dir: String,
}

impl ServerConfig {
    pub fn from_env() -> Result<Self> {
        let address =
            std::env::var("YELKEN_BIND_ADDRESS").context("YELKEN_BIND_ADDRESS is not defined")?;

        let address: SocketAddrV4 = address
            .parse()
            .context("invalid YELKEN_BIND_ADDRESS is given")?;

        let app_assets_dir = std::env::var("YELKEN_APP_ASSETS_DIR")
            .context("YELKEN_APP_ASSETS_DIR is not defined")?;

        let storage_dir =
            std::env::var("YELKEN_STORAGE_DIR").context("YELKEN_STORAGE_DIR is not defined")?;

        Ok(Self {
            address,
            app_assets_dir,
            storage_dir,
        })
    }
}

fn db_config_from_env() -> Result<DatabaseConfig> {
    if let Ok(url) = std::env::var("YELKEN_DATABASE_URL") {
        return Ok(DatabaseConfig { url });
    }

    let backend = std::env::var("YELKEN_DATABASE_PROTOCOL")
        .context("YELKEN_DATABASE_PROTOCOL is not defined")?;

    let host =
        std::env::var("YELKEN_DATABASE_HOST").context("YELKEN_DATABASE_HOST is not defined")?;

    let database =
        std::env::var("YELKEN_DATABASE_NAME").context("YELKEN_DATABASE_NAME is not defined")?;

    let user =
        std::env::var("YELKEN_DATABASE_USER").context("YELKEN_DATABASE_USER is not defined")?;

    let password = std::env::var("YELKEN_DATABASE_PASSWORD")
        .context("YELKEN_DATABASE_PASSWORD is not defined")?;

    Ok(DatabaseConfig {
        url: format!("{backend}://{user}:{password}@{host}/{database}"),
    })
}

fn config_from_env() -> Result<Config> {
    let env = std::env::var("YELKEN_ENV").context("YELKEN_ENV is not defined")?;

    let tmp_dir = std::env::var("YELKEN_TMP_DIR").context("YELKEN_TMP_DIR is not defined")?;

    let backend_url =
        std::env::var("YELKEN_BACKEND_URL").context("YELKEN_BACKEND_URL is not defined")?;

    let frontend_url =
        std::env::var("YELKEN_FRONTEND_URL").context("YELKEN_FRONTEND_URL is not defined")?;

    let reload_templates = std::env::var("YELKEN_RELOAD_TEMPLATES")
        .map(|var| var.as_str() == "on" || var.as_str() == "true" || var.as_str() == "yes")
        .unwrap_or(false);

    Ok(Config {
        env,
        tmp_dir,
        backend_url,
        frontend_url,
        reload_templates,
    })
}

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

    let db_config = db_config_from_env().unwrap();

    let command = std::env::args().nth(1).unwrap_or("".to_string());

    if command == "migrate" || command == "migrate-run" {
        setup::migrate(
            &mut <SyncConnection as diesel::Connection>::establish(&db_config.url).unwrap(),
        )
        .unwrap();

        if command != "migrate-run" {
            return;
        }
    }

    let db_config = AsyncDieselConnectionManager::<Connection>::new(&db_config.url);
    let pool = deadpool::Pool::builder(db_config).build().unwrap();

    let crypto = Crypto::new(
        std::env::var("YELKEN_SECRET_KEY")
            .expect("YELKEN_SECRET_KEY is not provided in env")
            .as_str(),
    );
    let config = config_from_env().unwrap();
    let server_config = ServerConfig::from_env().unwrap();

    let storage = {
        let builder = opendal::services::Fs::default().root(&server_config.storage_dir);

        opendal::Operator::new(builder).unwrap().finish()
    };

    let app = yelken::router(crypto, config, pool, storage)
        .await
        .layer(axum::middleware::from_fn(logger));

    let listener = tokio::net::TcpListener::bind(server_config.address)
        .await
        .unwrap();

    axum::serve(listener, app).await.unwrap();
}
