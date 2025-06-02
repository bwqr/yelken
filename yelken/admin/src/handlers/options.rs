use axum::{extract::State, Extension, Json};
use base::{
    config::Options,
    responses::HttpError,
    schema::{locales, options, themes},
    AppState,
};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use ui::{L10n, Render};
use unic_langid::LanguageIdentifier;

use crate::requests::{UpdateDefaultLocale, UpdateTheme};

pub async fn update_theme(
    State(state): State<AppState>,
    Extension(options): Extension<Options>,
    Extension(render): Extension<Render>,
    Extension(l10n): Extension<L10n>,
    Json(req): Json<UpdateTheme>,
) -> Result<(), HttpError> {
    let mut conn = state.pool.get().await?;

    let theme = themes::table
        .filter(themes::id.eq(req.theme))
        .select(themes::id)
        .first::<String>(&mut conn)
        .await?;

    let effected_row: usize = diesel::update(options::table)
        .filter(options::namespace.is_null().and(options::name.eq("theme")))
        .set(options::value.eq(&theme))
        .execute(&mut conn)
        .await?;

    if effected_row == 0 {
        diesel::insert_into(options::table)
            .values((options::name.eq("theme"), options::value.eq(&theme)))
            .execute(&mut conn)
            .await?;
    }

    options.set_theme(theme.into());

    l10n.reload(
        &state.storage,
        &options.locale_locations(),
        &options.locales(),
        options.default_locale(),
    )
    .await;

    render
        .reload(&state.storage, &options.template_locations())
        .await
        .inspect_err(|e| log::warn!("Failed to reload render, {e:?}"))
        .map_err(|_| HttpError::unprocessable_entity("invalid_template"))?;

    Ok(())
}

pub async fn update_default_locale(
    State(state): State<AppState>,
    Extension(options): Extension<Options>,
    Extension(l10n): Extension<L10n>,
    Json(req): Json<UpdateDefaultLocale>,
) -> Result<Json<()>, HttpError> {
    let mut conn = state.pool.get().await?;

    let locale_key: LanguageIdentifier = req
        .locale
        .parse()
        .map_err(|_| HttpError::unprocessable_entity("invalid_locale_key"))?;

    let (locale, disabled) = locales::table
        .filter(locales::key.eq(req.locale))
        .select((locales::key, locales::disabled))
        .first::<(String, bool)>(&mut conn)
        .await?;

    if disabled {
        return Err(HttpError::conflict("locale_disabled"));
    }

    let effected_row: usize = diesel::update(options::table)
        .filter(
            options::namespace
                .is_null()
                .and(options::name.eq("default_locale")),
        )
        .set(options::value.eq(&locale))
        .execute(&mut conn)
        .await?;

    if effected_row == 0 {
        diesel::insert_into(options::table)
            .values((
                options::name.eq("default_locale"),
                options::value.eq(&locale),
            ))
            .execute(&mut conn)
            .await?;
    }

    options.set_default_locale(locale_key);

    l10n.reload(
        &state.storage,
        &options.locale_locations(),
        &options.locales(),
        options.default_locale(),
    )
    .await;

    Ok(Json(()))
}
