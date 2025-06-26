use axum::{extract::State, Json};
use base::{models::Field, responses::HttpError, schema::fields, AppState};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;

pub mod asset;
pub mod content;
pub mod model;

pub async fn fetch_fields(State(state): State<AppState>) -> Result<Json<Vec<Field>>, HttpError> {
    fields::table
        .order(fields::id.asc())
        .load::<Field>(&mut state.pool.get().await?)
        .await
        .map(Json)
        .map_err(Into::into)
}
