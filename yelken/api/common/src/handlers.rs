use axum::{Extension, Json, extract::State};
use base::{
    AppState,
    config::Options,
    models::{Locale, Namespace},
    responses::HttpError,
    schema::{locales, namespaces},
};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;

pub async fn fetch_locales(State(state): State<AppState>) -> Result<Json<Vec<Locale>>, HttpError> {
    locales::table
        .order_by(locales::key.asc())
        .load::<Locale>(&mut state.pool.get().await?)
        .await
        .map(Json)
        .map_err(Into::into)
}

pub async fn fetch_namespaces(
    State(state): State<AppState>,
) -> Result<Json<Vec<Namespace>>, HttpError> {
    namespaces::table
        .order_by(namespaces::key.asc())
        .load::<Namespace>(&mut state.pool.get().await?)
        .await
        .map(Json)
        .map_err(Into::into)
}

pub async fn fetch_options(
    Extension(options): Extension<Options>,
) -> Result<Json<crate::responses::Options>, HttpError> {
    Ok(Json(crate::responses::Options {
        theme: options.theme().to_string(),
        default_locale: format!("{}", options.default_locale()),
    }))
}
