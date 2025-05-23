use std::net::SocketAddrV4;

use anyhow::{Context, Result};

pub struct DatabaseConfig {
    pub url: String,
}

impl DatabaseConfig {
    pub fn from_env() -> Result<Self> {
        if let Ok(url) = std::env::var("YELKEN_DATABASE_URL") {
            return Ok(Self { url });
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

        Ok(Self {
            url: format!("{backend}://{user}:{password}@{host}/{database}"),
        })
    }
}

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
