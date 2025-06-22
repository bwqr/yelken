use std::{str::FromStr, sync::Arc};

use arc_swap::ArcSwap;
use unic_langid::LanguageIdentifier;
use url::Url;

use crate::{
    db::Connection,
    schema::locales,
    services::SafePath,
    utils::{LocationKind, ResourceKind},
};

pub struct Config {
    pub env: String,
    pub site_url: Url,
    pub app_url: Url,
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
        let namespace = SafePath::from_str(&*self.theme())
            .inspect_err(|e| log::error!("Failed to parse theme as safe path, {e:?}"))
            .unwrap_or_else(|_| SafePath::from_str("").unwrap());

        [
            crate::utils::location(
                &LocationKind::Theme {
                    namespace: namespace.clone(),
                },
                ResourceKind::Locale,
            ),
            crate::utils::location(&LocationKind::Global, ResourceKind::Locale),
            crate::utils::location(&LocationKind::User { namespace }, ResourceKind::Locale),
        ]
    }

    pub fn template_locations(&self) -> [String; 3] {
        let namespace = SafePath::from_str(&*self.theme())
            .inspect_err(|e| log::error!("Failed to parse theme as safe path, {e:?}"))
            .unwrap_or_else(|_| SafePath::from_str("").unwrap());

        [
            crate::utils::location(
                &LocationKind::Theme {
                    namespace: namespace.clone(),
                },
                ResourceKind::Template,
            ),
            crate::utils::location(&LocationKind::Global, ResourceKind::Template),
            crate::utils::location(&LocationKind::User { namespace }, ResourceKind::Template),
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
