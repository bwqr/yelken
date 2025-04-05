mod handlers;
mod l10n;
mod render;

use std::{collections::HashMap, fs::read_to_string, path::PathBuf, sync::Arc};

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
            let path: PathBuf = [location, &format!("{id}.ftl")].iter().collect();

            log::debug!("loading localization file {path:?}");

            let ftl = match read_to_string(&path) {
                Ok(ftl) => ftl,
                Err(e) => {
                    log::warn!("Failed to read fluent file at path {path:?}, {e:?}");
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

        (id, bundle)
    });

    let bundles = HashMap::from_iter(bundles);

    L10n::new(supported_locales, default_locale, bundles)
}

pub fn build_render(locations: &[String], resources: FnResources) -> Render {
    let mut stack: Vec<(usize, PathBuf)> = locations
        .iter()
        .enumerate()
        .map(|(i, l)| (i, PathBuf::from(l)))
        .collect();

    let mut templates = HashMap::<String, String>::new();

    while let Some((index, path)) = stack.pop() {
        let Ok(dir) = std::fs::read_dir(&path)
            .inspect_err(|e| log::warn!("Failed to read directory {path:?} {e:?}"))
        else {
            continue;
        };

        for entry in dir {
            let Ok(entry) = entry.inspect_err(|e| log::warn!("Failed to get entry {e:?}")) else {
                continue;
            };
            let path = entry.path();

            if path.is_symlink() {
                continue;
            }

            if path.is_dir() {
                stack.push((index, path));
            } else if path.is_file()
                && path
                    .extension()
                    .and_then(|ext| ext.to_str())
                    .map(|ext| ext == "html")
                    .unwrap_or(false)
            {
                let key = path
                    .strip_prefix(&locations[index])
                    .unwrap()
                    .to_string_lossy()
                    .to_string();

                if !templates.contains_key(&key) {
                    log::debug!("loading template file {path:?}");

                    let Ok(template) = std::fs::read_to_string(&path)
                        .inspect_err(|e| log::warn!("Failed to read template {e:?}"))
                    else {
                        continue;
                    };

                    templates.insert(key, template);
                } else {
                    log::debug!("skipping template file {path:?}");
                }
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
