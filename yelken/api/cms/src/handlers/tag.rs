use axum::{
    extract::{Query, State},
    Json,
};
use base::{
    models::{Tag, TagResource},
    responses::HttpError,
    schema::{assets, contents, tags},
    AppState,
};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;

use crate::requests::{CreateTag, FilterTag};

pub async fn fetch_tags(
    State(state): State<AppState>,
    Query(req): Query<FilterTag>,
) -> Result<Json<Vec<Tag>>, HttpError> {
    tags::table
        .filter(
            tags::resource
                .eq(req.resource)
                .and(tags::resource_id.eq(req.resource_id)),
        )
        .load::<Tag>(&mut state.pool.get().await?)
        .await
        .map(Json)
        .map_err(Into::into)
}

pub async fn create_asset_tag(
    State(state): State<AppState>,
    Json(req): Json<CreateTag>,
) -> Result<Json<Tag>, HttpError> {
    let mut conn = state.pool.get().await?;

    let asset_id = assets::table
        .filter(assets::id.eq(req.resource_id))
        .select(assets::id)
        .first::<i32>(&mut conn)
        .await
        .optional()?
        .ok_or_else(|| HttpError::not_found("asset_not_found"))?;

    diesel::insert_into(tags::table)
        .values((
            tags::resource.eq(TagResource::Asset),
            tags::resource_id.eq(asset_id),
            tags::key.eq(req.key),
            tags::value.eq(req.value),
        ))
        .get_result::<Tag>(&mut conn)
        .await
        .map(Json)
        .map_err(Into::into)
}

pub async fn create_content_tag(
    State(state): State<AppState>,
    Json(req): Json<CreateTag>,
) -> Result<Json<Tag>, HttpError> {
    let mut conn = state.pool.get().await?;

    let content_id = contents::table
        .filter(contents::id.eq(req.resource_id))
        .select(contents::id)
        .first::<i32>(&mut conn)
        .await
        .optional()?
        .ok_or_else(|| HttpError::not_found("content_not_found"))?;

    diesel::insert_into(tags::table)
        .values((
            tags::resource.eq(TagResource::Content),
            tags::resource_id.eq(content_id),
            tags::key.eq(req.key),
            tags::value.eq(req.value),
        ))
        .get_result::<Tag>(&mut conn)
        .await
        .map(Json)
        .map_err(Into::into)
}
