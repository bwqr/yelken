use std::sync::Arc;

use anyhow::{Context, Result};
use arc_swap::ArcSwap;
use unic_langid::LanguageIdentifier;

use crate::{schema::locales, types::Connection};

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
    pub fn new(
        theme: Arc<str>,
        locales: Arc<[LanguageIdentifier]>,
        default_locale: LanguageIdentifier,
    ) -> Self {
        Self(Arc::new(ArcSwap::new(Arc::new(Inner {
            theme,
            locales,
            default_locale,
        }))))
    }

    pub fn locale_locations(&self) -> [String; 3] {
        let theme = self.theme();

        [
            // Theme provided localizations
            format!("themes/{}/locales", theme),
            // Global scoped, user provided localizations
            "locales/global".to_string(),
            // Theme scoped, user provided localizations
            format!("locales/themes/{}", theme),
        ]
    }

    pub fn template_locations(&self) -> [String; 3] {
        let theme = self.theme();

        [
            // Theme provided templates
            format!("themes/{}/templates/", theme),
            // Global scoped, user provided templates
            "templates/global/".to_string(),
            // Theme scoped, user provided templates
            format!("templates/themes/{}/", theme),
        ]
    }

    pub fn theme(&self) -> Arc<str> {
        self.0.load().theme.clone()
    }

    pub fn set_theme(&self, theme: Arc<str>) {
        let old = self.0.load();

        let inner = Inner {
            theme,
            locales: old.locales.clone(),
            default_locale: old.default_locale.clone(),
        };

        self.0.store(Arc::new(inner));
    }

    pub fn default_locale(&self) -> LanguageIdentifier {
        self.0.load().default_locale.clone()
    }

    pub fn set_default_locale(&self, default_locale: LanguageIdentifier) {
        let old = self.0.load();

        let inner = Inner {
            theme: old.theme.clone(),
            locales: old.locales.clone(),
            default_locale,
        };

        self.0.store(Arc::new(inner));
    }

    pub fn locales(&self) -> Arc<[LanguageIdentifier]> {
        self.0.load().locales.clone()
    }

    pub fn set_locales(&self, locales: Arc<[LanguageIdentifier]>) {
        let old = self.0.load();

        let inner = Inner {
            theme: old.theme.clone(),
            locales,
            default_locale: old.default_locale.clone(),
        };

        self.0.store(Arc::new(inner));
    }
}

impl Options {
    pub async fn load_locales<'a>(
        conn: &mut Connection<'a>,
    ) -> diesel::QueryResult<Arc<[LanguageIdentifier]>> {
        use diesel::prelude::*;
        use diesel_async::RunQueryDsl;

        let locales = locales::table
            .filter(locales::disabled.eq(false))
            .select(locales::key)
            .load::<String>(conn)
            .await?
            .into_iter()
            .flat_map(|key| {
                key.parse()
                    .inspect_err(|e| log::warn!("Failed to parse locale {key} due to {e:?}"))
                    .ok()
            })
            .collect();

        Ok(locales)
    }
}

struct Inner {
    theme: Arc<str>,
    locales: Arc<[LanguageIdentifier]>,
    default_locale: LanguageIdentifier,
}
