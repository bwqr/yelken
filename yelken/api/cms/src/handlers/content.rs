use std::collections::HashMap;

use crate::{
    requests::{
        ContentValue, CreateContent, FilterByModel, UpdateContent, UpdateContentStage,
        UpdateContentValue,
    },
    responses::ContentDetails,
};
use axum::{
    extract::{Path, Query, State},
    Extension, Json,
};
use base::{
    config::Options,
    db::BatchQuery,
    middlewares::auth::AuthUser,
    models::{Content, ContentStage},
    paginate::{CountStarOver, Paginate, Pagination, PaginationRequest},
    responses::HttpError,
    schema::{content_values, contents, fields, model_fields, models, users},
    AppState,
};
use diesel::prelude::*;
use diesel_async::{scoped_futures::ScopedFutureExt, AsyncConnection, RunQueryDsl};

pub async fn fetch_contents(
    State(state): State<AppState>,
    Query(req): Query<FilterByModel>,
    Query(page): Query<PaginationRequest>,
) -> Result<Json<Pagination<Content>>, HttpError> {
    contents::table
        .filter(contents::model_id.eq(req.model_id))
        .select((contents::all_columns, CountStarOver))
        .order(contents::id.desc())
        .paginate(page.page)
        .per_page(page.per_page)
        .load_and_count_pages::<Content>(&mut state.pool.get().await?)
        .await
        .map(Json)
        .map_err(Into::into)
}

pub async fn fetch_content(
    State(state): State<AppState>,
    Path(content_id): Path<i32>,
) -> Result<Json<ContentDetails>, HttpError> {
    let mut conn = state.pool.get().await?;

    let (content, user) = contents::table
        .left_join(users::table)
        .filter(contents::id.eq(content_id))
        .select((contents::all_columns, (users::id, users::name).nullable()))
        .first::<(Content, Option<(i32, String)>)>(&mut conn)
        .await?;

    let values = content_values::table
        .filter(content_values::content_id.eq(content_id))
        .order(content_values::id.asc())
        .load::<base::models::ContentValue>(&mut conn)
        .await?;

    let user = user.map(|u| crate::responses::User { id: u.0, name: u.1 });

    Ok(Json(ContentDetails {
        content,
        values,
        user,
    }))
}

pub async fn create_content(
    State(state): State<AppState>,
    Extension(options): Extension<Options>,
    user: AuthUser,
    Json(req): Json<CreateContent>,
) -> Result<Json<Content>, HttpError> {
    let mut conn = state.pool.get().await?;

    let locales = options
        .locales()
        .iter()
        .map(|l| format!("{l}"))
        .collect::<Vec<_>>();

    let Some(model) = models::table
        .filter(models::id.eq(req.model_id))
        .first::<base::models::Model>(&mut conn)
        .await
        .optional()?
    else {
        return Err(HttpError::not_found("model_not_found"));
    };

    let model_fields = fields::table
        .inner_join(model_fields::table)
        .filter(model_fields::model_id.eq(model.id))
        .select((model_fields::all_columns, fields::all_columns))
        .load::<(base::models::ModelField, base::models::Field)>(&mut conn)
        .await?;

    if let Some(err) = model_fields.iter().find_map(|(mf, _)| {
        let mut values = req.values.iter().filter(|v| v.model_field_id == mf.id);

        if mf.required && values.clone().next().is_none() {
            return Some("missing_required_field");
        }

        let value_locales = values.clone().filter_map(|v| v.locale.clone()).fold(
            HashMap::<String, u32>::new(),
            |mut acc, l| {
                let count = acc.entry(l).or_insert(0);
                *count += 1;
                acc
            },
        );

        if mf.required && mf.localized && locales.iter().any(|l| value_locales.get(l).is_none()) {
            return Some("missing_localization_for_required_field");
        }

        if !mf.multiple && value_locales.into_iter().any(|(_, count)| count > 1) {
            return Some("multiple_value_for_field");
        }

        if !values.all(|v| {
            (mf.localized
                && v.locale
                    .as_ref()
                    .is_some_and(|vl| locales.iter().any(|l| vl == l)))
                || (!mf.localized && v.locale.is_none())
        }) {
            return Some("invalid_locale_for_field");
        }

        None
    }) {
        return Err(HttpError::bad_request(err));
    }

    if req.values.iter().any(|v| {
        model_fields
            .iter()
            .find(|mf| mf.0.id == v.model_field_id)
            .is_none()
    }) {
        return Err(HttpError::not_found("model_field_not_found"));
    }

    let content = conn
        .transaction(|conn| {
            async move {
                let content = diesel::insert_into(contents::table)
                    .values((
                        contents::model_id.eq(req.model_id),
                        contents::name.eq(req.name),
                        contents::stage.eq(ContentStage::Draft),
                        contents::created_by.eq(user.id),
                    ))
                    .get_result::<Content>(conn)
                    .await?;

                diesel::insert_into(content_values::table)
                    .values(
                        req.values
                            .into_iter()
                            .map(|v| {
                                (
                                    content_values::content_id.eq(content.id),
                                    content_values::model_field_id.eq(v.model_field_id),
                                    content_values::locale.eq(v.locale),
                                    content_values::value.eq(v.value),
                                )
                            })
                            .collect::<Vec<_>>(),
                    )
                    .batched()
                    .execute(conn)
                    .await?;

                Result::<Content, HttpError>::Ok(content)
            }
            .scope_boxed()
        })
        .await?;

    Ok(Json(content))
}

pub async fn update_content(
    State(state): State<AppState>,
    Path(content_id): Path<i32>,
    Json(req): Json<UpdateContent>,
) -> Result<(), HttpError> {
    let effected_row: usize = diesel::update(contents::table)
        .filter(contents::id.eq(content_id))
        .set(contents::name.eq(req.name))
        .execute(&mut state.pool.get().await?)
        .await?;

    if effected_row == 0 {
        return Err(HttpError::not_found("content_not_found"));
    }

    Ok(())
}

pub async fn create_content_value(
    State(state): State<AppState>,
    Extension(options): Extension<Options>,
    Path(content_id): Path<i32>,
    Json(req): Json<ContentValue>,
) -> Result<Json<base::models::ContentValue>, HttpError> {
    let mut conn = state.pool.get().await?;

    let Some(model_id) = models::table
        .inner_join(contents::table)
        .filter(contents::id.eq(content_id))
        .select(models::id)
        .first::<i32>(&mut conn)
        .await
        .optional()?
    else {
        return Err(HttpError::not_found("content_not_found"));
    };

    let Some(model_field) = fields::table
        .inner_join(model_fields::table)
        .filter(
            model_fields::id
                .eq(req.model_field_id)
                .and(model_fields::model_id.eq(model_id)),
        )
        .select((model_fields::all_columns, fields::all_columns))
        .first::<(base::models::ModelField, base::models::Field)>(&mut conn)
        .await
        .optional()?
    else {
        return Err(HttpError::not_found("model_field_not_found"));
    };

    if (model_field.0.localized && req.locale.is_none())
        || (!model_field.0.localized && req.locale.is_some())
    {
        return Err(HttpError::bad_request("invalid_locale_for_field"));
    }

    if let Some(locale) = req.locale.as_ref() {
        if options
            .locales()
            .iter()
            .find(|l| format!("{l}") == *locale)
            .is_none()
        {
            return Err(HttpError::bad_request("invalid_locale_for_field"));
        }
    }

    if !model_field.0.multiple {
        let query = if let Some(locale) = req.locale.as_ref() {
            content_values::table
                .filter(
                    content_values::model_field_id
                        .eq(model_field.0.id)
                        .and(content_values::locale.eq(locale))
                        .and(content_values::content_id.eq(content_id)),
                )
                .into_boxed()
        } else {
            content_values::table
                .filter(
                    content_values::model_field_id
                        .eq(model_field.0.id)
                        .and(content_values::locale.is_null())
                        .and(content_values::content_id.eq(content_id)),
                )
                .into_boxed()
        };

        if diesel::dsl::select(diesel::dsl::exists(query))
            .get_result::<bool>(&mut conn)
            .await?
        {
            return Err(HttpError::conflict("content_value_already_exists"));
        }
    }

    diesel::insert_into(content_values::table)
        .values((
            content_values::content_id.eq(content_id),
            content_values::model_field_id.eq(model_field.0.id),
            content_values::locale.eq(req.locale),
            content_values::value.eq(req.value),
        ))
        .get_result::<base::models::ContentValue>(&mut conn)
        .await
        .map(Json)
        .map_err(Into::into)
}

pub async fn update_content_stage(
    State(state): State<AppState>,
    Path(content_id): Path<i32>,
    Json(req): Json<UpdateContentStage>,
) -> Result<(), HttpError> {
    let effected_row: usize = diesel::update(contents::table)
        .filter(contents::id.eq(content_id))
        .set(contents::stage.eq(req.stage))
        .execute(&mut state.pool.get().await?)
        .await?;

    if effected_row == 0 {
        return Err(HttpError::not_found("content_not_found"));
    }

    Ok(())
}

pub async fn update_content_value(
    State(state): State<AppState>,
    Path(value_id): Path<i32>,
    Json(req): Json<UpdateContentValue>,
) -> Result<(), HttpError> {
    let effected_row: usize = diesel::update(content_values::table)
        .filter(content_values::id.eq(value_id))
        .set(content_values::value.eq(req.value))
        .execute(&mut state.pool.get().await?)
        .await?;

    if effected_row == 0 {
        return Err(HttpError::not_found("content_value_not_found"));
    }

    Ok(())
}

pub async fn delete_content(
    State(state): State<AppState>,
    Path(content_id): Path<i32>,
) -> Result<(), HttpError> {
    let effected_row: usize = diesel::delete(contents::table)
        .filter(contents::id.eq(content_id))
        .execute(&mut state.pool.get().await?)
        .await?;

    if effected_row == 0 {
        return Err(HttpError::not_found("content_not_found"));
    }

    Ok(())
}

pub async fn delete_content_value(
    State(state): State<AppState>,
    Path(value_id): Path<i32>,
) -> Result<(), HttpError> {
    let effected_row: usize = diesel::delete(content_values::table)
        .filter(content_values::id.eq(value_id))
        .execute(&mut state.pool.get().await?)
        .await?;

    if effected_row == 0 {
        return Err(HttpError::not_found("value_not_found"));
    }

    Ok(())
}
