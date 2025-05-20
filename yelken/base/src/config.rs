use std::sync::Arc;

use arc_swap::ArcSwap;
use unic_langid::LanguageIdentifier;

use crate::{schema::locales, types::Connection};

#[derive(Default)]
pub struct Config {
    pub env: String,
    pub tmp_dir: String,
    pub backend_origin: String,
    pub frontend_origin: String,
    pub reload_templates: bool,
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
    pub async fn load_locales(
        conn: &mut Connection,
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
