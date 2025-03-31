use axum::{
    extract::{Path, State},
    Json,
};
use base::{models::Locale, responses::HttpError, schema::locales, AppState};
use diesel::{
    prelude::*,
    result::{DatabaseErrorKind, Error},
};
use diesel_async::RunQueryDsl;

use crate::requests::{CreateLocale, UpdateLocaleState};

pub async fn create_locale(
    State(state): State<AppState>,
    Json(req): Json<CreateLocale>,
) -> Result<Json<Locale>, HttpError> {
    let locale = diesel::insert_into(locales::table)
        .values((locales::key.eq(req.key), locales::name.eq(req.name)))
        .get_result::<Locale>(&mut state.pool.get().await?)
        .await?;

    Ok(Json(locale))
}

pub async fn update_locale_state(
    State(state): State<AppState>,
    Path(locale_key): Path<String>,
    Json(req): Json<UpdateLocaleState>,
) -> Result<(), HttpError> {
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
