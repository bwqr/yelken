use anyhow::{Context, Result};

#[derive(Default)]
pub struct Config {
    pub env: String,
    pub tmp_dir: String,
    pub api_origin: String,
    pub web_origin: String,
    pub theme: String,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        let env = std::env::var("YELKEN_ENV").context("YELKEN_ENV is not defined")?;

        let tmp_dir = std::env::var("YELKEN_TMP_DIR").context("YELKEN_TMP_DIR is not defined")?;

        let api_origin =
            std::env::var("YELKEN_API_ORIGIN").context("YELKEN_API_ORIGIN is not defined")?;

        let web_origin =
            std::env::var("YELKEN_WEB_ORIGIN").context("YELKEN_WEB_ORIGIN is not defined")?;

        let theme = std::env::var("YELKEN_THEME").context("YELKEN_THEME is not defined")?;

        Ok(Self {
            env,
            tmp_dir,
            api_origin,
            web_origin,
            theme,
        })
    }
}
