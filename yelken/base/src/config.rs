use std::sync::Arc;

use arc_swap::ArcSwap;
use serde::{Deserialize, Serialize};
use unic_langid::LanguageIdentifier;
use url::Url;

use crate::{db::Connection, schema::locales};

pub struct Config {
    pub env: String,
    pub site_url: Url,
    pub app_url: Url,
    pub reload_templates: bool,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum LocationKind {
    Global,
    Theme,
    User,
}

#[derive(Debug)]
pub struct Location {
    pub path: String,
    pub kind: LocationKind,
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

    pub fn locale_locations(&self) -> [Location; 3] {
        let theme = self.theme();

        [
            Location {
                path: format!("themes/{}/locales", theme),
                kind: LocationKind::Theme,
            },
            Location {
                path: "locales/global".to_string(),
                kind: LocationKind::Global,
            },
            Location {
                path: format!("locales/themes/{}", theme),
                kind: LocationKind::User,
            },
        ]
    }

    pub fn template_locations(&self) -> [Location; 3] {
        let theme = self.theme();

        [
            Location {
                path: format!("themes/{}/templates", theme),
                kind: LocationKind::Theme,
            },
            Location {
                path: "templates/global".to_string(),
                kind: LocationKind::Global,
            },
            Location {
                path: format!("templates/themes/{}", theme),
                kind: LocationKind::User,
            },
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
