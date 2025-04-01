mod handlers;
mod l10n;
mod render;

use std::{collections::HashMap, fs::read_to_string, sync::Arc};

use axum::{middleware, routing::post, Router};
use fluent::{concurrent::FluentBundle, FluentResource};
pub use handlers::serve_page;

use base::AppState;
use l10n::L10n;
use render::{FnResources, Render};
use unic_langid::LanguageIdentifier;

pub async fn build_l10n(
    supported_locales: Arc<[LanguageIdentifier]>,
    default_locale: LanguageIdentifier,
    locations: &[String],
) -> L10n {
    // TODO move blocking operation inside block_on
    let bundles = supported_locales.iter().cloned().map(|id| {
        let mut bundle = FluentBundle::new_concurrent(vec![id.clone(), default_locale.clone()]);

        for location in locations.iter() {
            let path = format!("{location}/{id}.ftl");
            let ftl = match read_to_string(&path) {
                Ok(ftl) => ftl,
                Err(e) => {
                    log::warn!("Failed to read fluent file at path {path}, {e:?}");
                    continue;
                }
            };

            let resource = match FluentResource::try_new(ftl) {
                Ok(resource) => resource,
                Err(e) => {
                    log::warn!("Failed to parse fluent file as resource, {e:?}");

                    continue;
                }
            };

            bundle.add_resource_overriding(resource);
        }

        (id, bundle)
    });

    let bundles = HashMap::from_iter(bundles);

    L10n::new(supported_locales, default_locale, bundles)
}

pub fn build_render(templates_dir: &str, resources: FnResources) -> Render {
    Render::from_dir(templates_dir, Some(resources)).unwrap()
}

pub fn router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/templates/refresh", post(handlers::refresh_templates))
        .layer(middleware::from_fn_with_state(
            state,
            base::middlewares::auth::from_token,
        ))
}
