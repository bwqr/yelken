use std::collections::HashMap;

use axum::{
    extract::{Path, State},
    http::{self, HeaderMap, StatusCode},
    routing::post,
    Form, Router,
};
use base::{models::HttpError, schema::form_submissions, AppState};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;

pub fn router() -> Router<AppState> {
    Router::new().route("/submit/{form}", post(form_submit))
}

async fn form_submit(
    State(state): State<AppState>,
    Path(name): Path<String>,
    Form(form): Form<HashMap<String, String>>,
) -> Result<(StatusCode, HeaderMap), HttpError> {
    diesel::insert_into(form_submissions::table)
        .values((
            form_submissions::name.eq(name),
            form_submissions::values.eq(format!("{form:?}")),
        ))
        .execute(&mut state.pool.get().await?)
        .await?;

    Ok((
        StatusCode::SEE_OTHER,
        HeaderMap::from_iter([(http::header::LOCATION, "/".parse().unwrap())]),
    ))
}
