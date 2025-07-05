use std::collections::HashMap;

use axum::{
    extract::{Path, Query, State},
    http::{header, HeaderMap, StatusCode},
    Form, Json,
};
use base::{responses::HttpError, schema::form_submissions, AppState};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use url::Url;

pub async fn fetch_forms() -> Result<Json<Vec<()>>, HttpError> {
    Ok(Json(vec![]))
}

#[derive(serde::Deserialize)]
pub struct FormRedirect {
    redirect: Option<String>,
}

pub async fn handle_form_submissions(
    State(state): State<AppState>,
    Path(name): Path<String>,
    Query(query): Query<FormRedirect>,
    Form(form): Form<HashMap<String, String>>,
) -> Result<(StatusCode, HeaderMap), HttpError> {
    let redirect: header::HeaderValue = query
        .redirect
        .and_then(|r| {
            let url: Url = r.parse().ok()?;

            url.path().parse().ok()
        })
        .unwrap_or("/".parse().unwrap());

    diesel::insert_into(form_submissions::table)
        .values((
            form_submissions::name.eq(name),
            form_submissions::values.eq(format!("{form:?}")),
        ))
        .execute(&mut state.pool.get().await?)
        .await?;

    Ok((
        StatusCode::SEE_OTHER,
        HeaderMap::from_iter([(header::LOCATION, redirect)]),
    ))
}
