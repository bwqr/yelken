use std::collections::HashMap;

use axum::{extract::State, Json};
use base::{responses::HttpError, schema::options, AppState};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;

use crate::requests::UpdateSiteOption;

pub async fn fetch_site_options(
    State(state): State<AppState>,
) -> Result<Json<HashMap<String, String>>, HttpError> {
    options::table
        .filter(
            options::namespace
                .is_null()
                .and(options::key.like("site.%")),
        )
        .select((options::key, options::value))
        .load::<(String, String)>(&mut state.pool.get().await?)
        .await
        .map(|v| Json(HashMap::from_iter(v.into_iter())))
        .map_err(Into::into)
}

pub async fn update_site_option(
    State(state): State<AppState>,
    Json(req): Json<UpdateSiteOption>,
) -> Result<(), HttpError> {
    if !req.key.starts_with("site.") {
        return Err(HttpError::unprocessable_entity("invalid_option_key"));
    }

    let mut conn = state.pool.get().await?;

    let effected_row: usize = diesel::update(options::table)
        .filter(options::namespace.is_null().and(options::key.eq(&req.key)))
        .set(options::value.eq(&req.value))
        .execute(&mut conn)
        .await?;

    if effected_row == 0 {
        diesel::insert_into(options::table)
            .values((
                options::namespace.eq(Option::<String>::None),
                options::key.eq(req.key),
                options::value.eq(req.value),
            ))
            .execute(&mut conn)
            .await?;
    }

    Ok(())
}
