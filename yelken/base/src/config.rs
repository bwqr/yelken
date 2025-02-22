use anyhow::{Context, Result};

pub struct Config {
    pub storage_dir: String,
    pub api_origin: String,
    pub web_origin: String,
    pub app_root: String,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        let storage_dir =
            std::env::var("YELKEN_STORAGE_DIR").context("YELKEN_STORAGE_DIR is not defined")?;

        let api_origin =
            std::env::var("YELKEN_API_ORIGIN").context("YELKEN_API_ORIGIN is not defined")?;

        let web_origin =
            std::env::var("YELKEN_WEB_ORIGIN").context("YELKEN_WEB_ORIGIN is not defined")?;

        let app_root =
            std::env::var("YELKEN_APP_ROOT").context("YELKEN_APP_ROOT is not defined")?;

        Ok(Self {
            storage_dir,
            api_origin,
            web_origin,
            app_root,
        })
    }
}
