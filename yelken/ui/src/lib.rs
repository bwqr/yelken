mod handlers;
mod l10n;
mod render;

use std::{collections::HashMap, sync::Arc};

use axum::{middleware, routing::post, Router};
use fluent::{concurrent::FluentBundle, FluentResource};
pub use handlers::serve_page;

use base::AppState;
use l10n::L10n;
use opendal::{EntryMode, Operator};
use render::{FnResources, Render};
use unic_langid::LanguageIdentifier;

pub async fn build_l10n(
    storage: Operator,
    supported_locales: Arc<[LanguageIdentifier]>,
    default_locale: LanguageIdentifier,
    locations: &[String],
) -> L10n {
    let mut bundles = HashMap::new();

    for locale in supported_locales.into_iter() {
        let mut bundle = FluentBundle::new_concurrent(vec![locale.clone(), default_locale.clone()]);

        for location in locations.iter() {
            let path: String = [location.as_str(), format!("{locale}.ftl").as_str()].join("/");

            log::debug!("loading localization file {path:?}");

            let ftl = match storage
                .read(&path)
                .await
                .map(|buf| std::str::from_utf8(&*buf.to_bytes()).map(|s| s.to_string()))
            {
                Ok(Ok(ftl)) => ftl,
                Ok(Err(e)) => {
                    log::debug!("Failed to read fluent file at path {path:?}, {e:?}");
                    continue;
                }
                Err(e) => {
                    log::debug!("Failed to read fluent file at path {path:?}, {e}");
                    continue;
                }
            };

            let resource = match FluentResource::try_new(ftl) {
                Ok(resource) => resource,
                Err(e) => {
                    log::warn!("Failed to parse fluent file as resource at path {path:?}, {e:?}");

                    continue;
                }
            };

            bundle.add_resource_overriding(resource);
        }

        bundles.insert(locale.clone(), bundle);
    }

    L10n::new(supported_locales, default_locale, bundles)
}

pub async fn build_render(
    storage: Operator,
    locations: &[String],
    resources: FnResources,
) -> Render {
    let mut templates = HashMap::<String, String>::new();

    for location in locations {
        let Ok(entries) = storage
            .list_with(location)
            .recursive(true)
            .await
            .inspect_err(|e| log::debug!("Failed to read directory {location:?} {e:?}"))
        else {
            continue;
        };

        for entry in entries {
            if entry.metadata().mode() != EntryMode::FILE || !entry.path().ends_with(".html") {
                continue;
            }

            let key = entry.path().strip_prefix(location).unwrap();

            if !templates.contains_key(key) {
                log::debug!("loading template file {}", entry.path());

                let Ok(bytes) = storage
                    .read(entry.path())
                    .await
                    .inspect_err(|e| log::warn!("Failed to read template {e}"))
                    .map(|b| b.to_bytes())
                else {
                    continue;
                };

                let Ok(template) = std::str::from_utf8(&*bytes)
                    .inspect_err(|e| log::warn!("Failed to read template as string {e:?}"))
                else {
                    continue;
                };

                templates.insert(key.to_string(), template.to_string());
            } else {
                log::debug!("skipping template file {}", entry.path());
            }
        }
    }

    Render::new(templates.into_iter().collect(), Some(resources)).unwrap()
}

pub fn router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/templates/refresh", post(handlers::refresh_templates))
        .layer(middleware::from_fn_with_state(
            state,
            base::middlewares::auth::from_token,
        ))
}
