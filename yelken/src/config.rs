use std::net::SocketAddrV4;

use anyhow::{Context, Result};

pub struct ServerConfig {
    pub address: SocketAddrV4,
    pub database_url: String,
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

        let database_url =
            std::env::var("YELKEN_DATABASE_URL").context("YELKEN_DATABASE_URL is not defined")?;

        let app_assets_dir = std::env::var("YELKEN_APP_ASSETS_DIR")
            .context("YELKEN_APP_ASSETS_DIR is not defined")?;

        let storage_dir =
            std::env::var("YELKEN_STORAGE_DIR").context("YELKEN_STORAGE_DIR is not defined")?;

        Ok(Self {
            address,
            database_url,
            app_assets_dir,
            storage_dir,
        })
    }
}
