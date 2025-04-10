use axum::{
    extract::{Path, Query, State},
    Extension, Json,
};
use base::{config::Options, models::Locale, responses::HttpError, schema::locales, AppState};
use diesel::{
    prelude::*,
    result::{DatabaseErrorKind, Error},
};
use diesel_async::RunQueryDsl;
use fluent::FluentResource;
use unic_langid::LanguageIdentifier;

use crate::requests::{
    CreateLocale, DeleteLocaleResource, UpdateLocaleResource, UpdateLocaleState,
};

pub async fn create_locale(
    State(state): State<AppState>,
    Json(req): Json<CreateLocale>,
) -> Result<Json<Locale>, HttpError> {
    if req.key.parse::<LanguageIdentifier>().is_err() {
        return Err(HttpError::unprocessable_entity("invalid_locale_key"));
    }

    let locale = diesel::insert_into(locales::table)
        .values((locales::key.eq(req.key), locales::name.eq(req.name)))
        .get_result::<Locale>(&mut state.pool.get().await?)
        .await
        .map_err(|e| {
            if let Error::DatabaseError(DatabaseErrorKind::UniqueViolation, _) = &e {
                return HttpError::conflict("locale_key_already_exists");
            }

            e.into()
        })?;

    Ok(Json(locale))
}

pub async fn update_locale_state(
    State(state): State<AppState>,
    Path(locale_key): Path<String>,
    Json(req): Json<UpdateLocaleState>,
) -> Result<(), HttpError> {
    // TODO prevent disabling a default locale
    let effected_row = diesel::update(locales::table)
        .filter(locales::key.eq(locale_key))
        .set(locales::disabled.eq(req.disabled))
        .execute(&mut state.pool.get().await?)
        .await?;

    if effected_row == 0 {
        return Err(HttpError::not_found("locale_not_found"));
    }

    Ok(())
}

pub async fn delete_locale(
    State(state): State<AppState>,
    Path(locale_key): Path<String>,
) -> Result<(), HttpError> {
    // TODO prevent deleting a default locale
    let effected_row = diesel::delete(locales::table)
        .filter(locales::key.eq(locale_key))
        .execute(&mut state.pool.get().await?)
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

    Ok(())
}

pub async fn update_locale_resource(
    State(state): State<AppState>,
    Extension(options): Extension<Options>,
    Path(locale_key): Path<String>,
    Json(req): Json<UpdateLocaleResource>,
) -> Result<(), HttpError> {
    if let Err(e) = FluentResource::try_new(req.resource.clone()) {
        log::debug!("Failed to parse fluent resource successfully, {e:?}");

        return Err(HttpError::unprocessable_entity("invalid_fluent_resource"));
    }

    let Some(locale) = locales::table
        .filter(locales::key.eq(locale_key))
        .first::<Locale>(&mut state.pool.get().await?)
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
            &format!("{}.ftl", locale.key),
        ]
        .join("/")
    } else {
        ["locales", "global", &format!("{}.ftl", locale.key)].join("/")
    };

    state
        .storage
        .write(&path, req.resource)
        .await
        .inspect_err(|e| log::error!("Failed to write resource at path {path}, {e:?}"))
        .map_err(|_| HttpError::internal_server_error("failed_writing_resource"))?;

    Ok(())
}

pub async fn delete_locale_resource(
    State(state): State<AppState>,
    Extension(options): Extension<Options>,
    Path(locale_key): Path<String>,
    Query(req): Query<DeleteLocaleResource>,
) -> Result<(), HttpError> {
    let Some(locale) = locales::table
        .filter(locales::key.eq(locale_key))
        .first::<Locale>(&mut state.pool.get().await?)
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
            &format!("{}.ftl", locale.key),
        ]
        .join("/")
    } else {
        ["locales", "global", &format!("{}.ftl", locale.key)].join("/")
    };

    state
        .storage
        .delete(&path)
        .await
        .inspect_err(|e| log::error!("Failed to remove locale resource at path {path}, {e:?}"))
        .map_err(|_| HttpError::internal_server_error("failed_deleting_resource"))?;

    Ok(())
}
