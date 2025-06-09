use axum::{extract::State, Extension, Json};
use base::{
    config::Options,
    models::{Field, Locale},
    responses::HttpError,
    schema::{fields, locales},
    AppState,
};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;

pub mod asset;
pub mod content;
pub mod model;

pub async fn fetch_options(
    Extension(options): Extension<Options>,
) -> Result<Json<crate::responses::Options>, HttpError> {
    Ok(Json(crate::responses::Options {
        theme: options.theme().to_string(),
        default_locale: format!("{}", options.default_locale()),
    }))
}

pub async fn fetch_fields(State(state): State<AppState>) -> Result<Json<Vec<Field>>, HttpError> {
    fields::table
        .load::<Field>(&mut state.pool.get().await?)
        .await
        .map(Json)
        .map_err(Into::into)
}

pub async fn fetch_locales(State(state): State<AppState>) -> Result<Json<Vec<Locale>>, HttpError> {
    locales::table
        .order_by(locales::key.asc())
        .load::<Locale>(&mut state.pool.get().await?)
        .await
        .map(Json)
        .map_err(Into::into)
}
