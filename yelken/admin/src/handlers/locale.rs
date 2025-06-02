use axum::{
    extract::{Path, Query, State},
    Extension, Json,
};
use base::{
    config::Options, models::Locale, responses::HttpError, runtime::IntoSendFuture,
    schema::locales, AppState,
};
use diesel::{
    prelude::*,
    result::{DatabaseErrorKind, Error},
};
use diesel_async::RunQueryDsl;
use fluent::FluentResource;
use ui::L10n;
use unic_langid::LanguageIdentifier;

use crate::requests::{
    CreateLocale, DeleteLocaleResource, UpdateLocaleResource, UpdateLocaleState,
};

pub async fn create_locale(
    State(state): State<AppState>,
    Extension(options): Extension<Options>,
    Extension(l10n): Extension<L10n>,
    Json(req): Json<CreateLocale>,
) -> Result<Json<Locale>, HttpError> {
    if req.key.parse::<LanguageIdentifier>().is_err() {
        return Err(HttpError::unprocessable_entity("invalid_locale_key"));
    }

    let mut conn = state.pool.get().await?;

    let locale = diesel::insert_into(locales::table)
        .values((locales::key.eq(req.key), locales::name.eq(req.name)))
        .get_result::<Locale>(&mut conn)
        .await
        .map_err(|e| {
            if let Error::DatabaseError(DatabaseErrorKind::UniqueViolation, _) = &e {
                return HttpError::conflict("locale_key_already_exists");
            }

            e.into()
        })?;

    options.set_locales(Options::load_locales(&mut conn).await?);

    l10n.reload(
        &state.storage,
        &options.locale_locations(),
        &options.locales(),
        options.default_locale(),
    )
    .await;

    Ok(Json(locale))
}

pub async fn update_locale_state(
    State(state): State<AppState>,
    Extension(options): Extension<Options>,
    Extension(l10n): Extension<L10n>,
    Path(locale_key): Path<String>,
    Json(req): Json<UpdateLocaleState>,
) -> Result<Json<()>, HttpError> {
    if req.disabled && format!("{}", options.default_locale()) == locale_key {
        return Err(HttpError::conflict("cannot_disable_default_locale"));
    }

    let mut conn = state.pool.get().await?;

    let effected_row = diesel::update(locales::table)
        .filter(locales::key.eq(locale_key))
        .set(locales::disabled.eq(req.disabled))
        .execute(&mut conn)
        .await?;

    if effected_row == 0 {
        return Err(HttpError::not_found("locale_not_found"));
    }

    options.set_locales(Options::load_locales(&mut conn).await?);

    l10n.reload(
        &state.storage,
        &options.locale_locations(),
        &options.locales(),
        options.default_locale(),
    )
    .await;

    Ok(Json(()))
}

pub async fn delete_locale(
    State(state): State<AppState>,
    Extension(options): Extension<Options>,
    Extension(l10n): Extension<L10n>,
    Path(locale_key): Path<String>,
) -> Result<(), HttpError> {
    if format!("{}", options.default_locale()) == locale_key {
        return Err(HttpError::conflict("cannot_delete_default_locale"));
    }

    let mut conn = state.pool.get().await?;

    let effected_row = diesel::delete(locales::table)
        .filter(locales::key.eq(&locale_key))
        .execute(&mut conn)
        .await
        .map_err(|e| {
            if let Error::DatabaseError(DatabaseErrorKind::ForeignKeyViolation, _) = &e {
                return HttpError::conflict("locale_being_used");
            }

            e.into()
        })?;

    if effected_row == 0 {
        return Err(HttpError::not_found("locale_not_found"));
    }

    // TODO consider removing resources belonging to this locale

    options.set_locales(Options::load_locales(&mut conn).await?);

    l10n.reload(
        &state.storage,
        &options.locale_locations(),
        &options.locales(),
        options.default_locale(),
    )
    .await;

    Ok(())
}

pub async fn update_locale_resource(
    State(state): State<AppState>,
    Extension(options): Extension<Options>,
    Extension(l10n): Extension<L10n>,
    Path(locale_key): Path<String>,
    Json(req): Json<UpdateLocaleResource>,
) -> Result<(), HttpError> {
    if let Err(e) = FluentResource::try_new(req.resource.clone()) {
        log::debug!("Failed to parse fluent resource successfully, {e:?}");

        return Err(HttpError::unprocessable_entity("invalid_fluent_resource"));
    }

    let Some(locale) = locales::table
        .filter(locales::key.eq(locale_key))
        .select(locales::key)
        .first::<String>(&mut state.pool.get().await?)
        .await
        .optional()?
    else {
        return Err(HttpError::not_found("locale_not_found"));
    };

    let path = if req.theme_scoped {
        [
            "locales",
            "themes",
            &options.theme(),
            &format!("{}.ftl", locale),
        ]
        .join("/")
    } else {
        ["locales", "global", &format!("{}.ftl", locale)].join("/")
    };

    state
        .storage
        .write(&path, req.resource)
        .into_send_future()
        .await
        .inspect_err(|e| log::error!("Failed to write resource at path {path}, {e:?}"))
        .map_err(|_| HttpError::internal_server_error("failed_writing_resource"))?;

    l10n.reload(
        &state.storage,
        &options.locale_locations(),
        &options.locales(),
        options.default_locale(),
    )
    .await;

    Ok(())
}

pub async fn delete_locale_resource(
    State(state): State<AppState>,
    Extension(options): Extension<Options>,
    Extension(l10n): Extension<L10n>,
    Path(locale_key): Path<String>,
    Query(req): Query<DeleteLocaleResource>,
) -> Result<(), HttpError> {
    let Some(locale) = locales::table
        .filter(locales::key.eq(locale_key))
        .select(locales::key)
        .first::<String>(&mut state.pool.get().await?)
        .await
        .optional()?
    else {
        return Err(HttpError::not_found("locale_not_found"));
    };

    let path = if req.theme_scoped {
        [
            "locales",
            "themes",
            &options.theme(),
            &format!("{}.ftl", locale),
        ]
        .join("/")
    } else {
        ["locales", "global", &format!("{}.ftl", locale)].join("/")
    };

    state
        .storage
        .delete(&path)
        .into_send_future()
        .await
        .inspect_err(|e| log::error!("Failed to remove locale resource at path {path}, {e:?}"))
        .map_err(|_| HttpError::internal_server_error("failed_deleting_resource"))?;

    l10n.reload(
        &state.storage,
        &options.locale_locations(),
        &options.locales(),
        options.default_locale(),
    )
    .await;

    Ok(())
}
