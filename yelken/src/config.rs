use std::net::SocketAddrV4;

use anyhow::{Context, Result};

pub struct ServerConfig {
    pub address: SocketAddrV4,
    pub database_url: String,
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

        Ok(Self {
            address,
            database_url,
        })
    }
}
