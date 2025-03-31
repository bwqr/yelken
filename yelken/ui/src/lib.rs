mod handlers;
mod l10n;
mod render;

use std::{collections::HashMap, sync::Arc};

use axum::{middleware, routing::post, Router};
use fluent::{concurrent::FluentBundle, FluentResource};
pub use handlers::serve_page;

use base::{schema::locales, types::Connection, AppState};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use l10n::Locale;
use render::{FnResources, Render};
use unic_langid::LanguageIdentifier;

pub async fn build_locale(locales_dir: &str, mut conn: Connection<'_>) -> Locale {
    let locales = locales::table
        .select(locales::key)
        .load::<String>(&mut conn)
        .await
        .unwrap();

    let default: LanguageIdentifier = match locales.get(0).map(|locale| locale.parse()) {
        Some(Ok(locale)) => locale,
        _ => {
            log::warn!("Either there is no locale in database or an invalid one exists, using default locale \"en\"");

            "en".parse().unwrap()
        }
    };

    let supported_locales: Arc<[LanguageIdentifier]> = locales
        .into_iter()
        .flat_map(|locale| {
            locale
                .parse()
                .inspect_err(|e| log::warn!("Failed to parse locale {locale} due to {e:?}"))
                .ok()
        })
        .collect();

    let bundles = HashMap::from_iter(supported_locales.iter().cloned().map(|id| {
        let mut bundle = FluentBundle::new_concurrent(vec![id.clone(), default.clone()]);

        let resource = FluentResource::try_new(
            std::fs::read_to_string(format!("{locales_dir}/{id}.ftl")).unwrap(),
        )
        .unwrap();

        if let Err(e) = bundle.add_resource(resource) {
            log::warn!("Failed to add resource to localization bundle, {e:?}");
        }

        (id, bundle)
    }));

    Locale::new(supported_locales, default, bundles)
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
