use std::sync::Arc;

use anyhow::{Context, Result};
use arc_swap::ArcSwap;
use unic_langid::LanguageIdentifier;

#[derive(Default)]
pub struct Config {
    pub env: String,
    pub tmp_dir: String,
    pub api_origin: String,
    pub web_origin: String,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        let env = std::env::var("YELKEN_ENV").context("YELKEN_ENV is not defined")?;

        let tmp_dir = std::env::var("YELKEN_TMP_DIR").context("YELKEN_TMP_DIR is not defined")?;

        let api_origin =
            std::env::var("YELKEN_API_ORIGIN").context("YELKEN_API_ORIGIN is not defined")?;

        let web_origin =
            std::env::var("YELKEN_WEB_ORIGIN").context("YELKEN_WEB_ORIGIN is not defined")?;

        Ok(Self {
            env,
            tmp_dir,
            api_origin,
            web_origin,
        })
    }
}

#[derive(Clone)]
pub struct Options(Arc<ArcSwap<Inner>>);

impl Options {
    pub fn new(theme: Arc<str>, default_locale: LanguageIdentifier) -> Self {
        Self(Arc::new(ArcSwap::new(Arc::new(Inner {
            theme,
            default_locale,
        }))))
    }

    pub fn theme(&self) -> Arc<str> {
        self.0.load().theme.clone()
    }

    pub fn default_locale(&self) -> LanguageIdentifier {
        self.0.load().default_locale.clone()
    }
}

struct Inner {
    theme: Arc<str>,
    default_locale: LanguageIdentifier,
}
