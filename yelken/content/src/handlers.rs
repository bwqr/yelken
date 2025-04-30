use axum::{
    extract::{Path, State},
    Extension, Json,
};
use base::{
    config::Options,
    responses::HttpError,
    schema::{content_values, contents, fields, model_fields, models},
    AppState,
};
use diesel::prelude::*;
use diesel_async::{scoped_futures::ScopedFutureExt, AsyncConnection, RunQueryDsl};
use shared::content::{ContentValue, CreateContent, CreateModel, Field, Model, UpdateContentValue};

pub async fn fetch_fields(State(state): State<AppState>) -> Result<Json<Vec<Field>>, HttpError> {
    fields::table
        .select((fields::id, fields::name, fields::kind))
        .load::<(i32, String, String)>(&mut state.pool.get().await?)
        .await
        .map(|fs| {
            Json(
                fs.into_iter()
                    .map(|f| Field {
                        id: f.0,
                        name: f.1,
                        kind: f.2,
                    })
                    .collect(),
            )
        })
        .map_err(Into::into)
}

pub async fn fetch_models(State(state): State<AppState>) -> Result<Json<Vec<Model>>, HttpError> {
    models::table
        .load::<base::models::Model>(&mut state.pool.get().await?)
        .await
        .map(|ms| {
            Json(
                ms.into_iter()
                    .map(|m| Model {
                        id: m.id,
                        namespace: m.namespace,
                        name: m.name,
                    })
                    .collect(),
            )
        })
        .map_err(Into::into)
}

pub async fn create_model(
    State(state): State<AppState>,
    Extension(options): Extension<Options>,
    Json(req): Json<CreateModel>,
) -> Result<Json<Model>, HttpError> {
    let mut conn = state.pool.get().await?;

    let theme = options.theme();

    let exists = if req.theme_scoped {
        diesel::dsl::select(diesel::dsl::exists(
            models::table.filter(
                models::namespace
                    .eq(&*theme)
                    .and(models::name.eq(&req.name)),
            ),
        ))
        .get_result::<bool>(&mut conn)
        .await
    } else {
        diesel::dsl::select(diesel::dsl::exists(
            models::table.filter(models::namespace.is_null().and(models::name.eq(&req.name))),
        ))
        .get_result::<bool>(&mut conn)
        .await
    };

    if exists? {
        return Err(HttpError::conflict("model_already_exists"));
    }

    let model = conn
        .transaction(|conn| {
            async move {
                let model = diesel::insert_into(models::table)
                    .values((
                        models::namespace.eq(req.theme_scoped.then_some(&*theme)),
                        models::name.eq(req.name),
                    ))
                    .get_result::<base::models::Model>(conn)
                    .await?;

                diesel::insert_into(model_fields::table)
                    .values(
                        req.model_fields
                            .into_iter()
                            .map(|mf| {
                                (
                                    model_fields::field_id.eq(mf.field_id),
                                    model_fields::model_id.eq(model.id),
                                    model_fields::name.eq(mf.name),
                                    model_fields::localized.eq(mf.localized),
                                    model_fields::multiple.eq(mf.multiple),
                                    model_fields::required.eq(mf.required),
                                )
                            })
                            .collect::<Vec<_>>(),
                    )
                    .execute(conn)
                    .await?;

                Result::<base::models::Model, HttpError>::Ok(model)
            }
            .scope_boxed()
        })
        .await?;

    Ok(Json(Model {
        id: model.id,
        namespace: model.namespace,
        name: model.name,
    }))
}

pub async fn create_content(
    State(state): State<AppState>,
    Extension(options): Extension<Options>,
    Json(req): Json<CreateContent>,
) -> Result<(), HttpError> {
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

    if let Some(err) = model_fields.iter().find_map(|mf| {
        let mut values = req.values.iter().filter(|v| v.model_field_id == mf.0.id);

        if mf.0.required && values.clone().next().is_none() {
            return Some("missing_required_field");
        }

        // TODO check multiple values for each locale separately if mf is localized
        if !mf.0.multiple && values.clone().nth(1).is_some() {
            return Some("multiple_value_for_field");
        }

        if !values.all(|v| {
            (mf.0.localized
                && v.locale
                    .as_ref()
                    .is_some_and(|vl| locales.iter().any(|l| vl == l)))
                || (!mf.0.localized && v.locale.is_none())
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

    conn.transaction(|conn| {
        async move {
            let content = diesel::insert_into(contents::table)
                .values((
                    contents::model_id.eq(req.model_id),
                    contents::name.eq(req.name),
                ))
                .get_result::<base::models::Content>(conn)
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
                .execute(conn)
                .await?;

            Result::<(), HttpError>::Ok(())
        }
        .scope_boxed()
    })
    .await?;

    Ok(())
}

pub async fn create_content_value(
    State(state): State<AppState>,
    Extension(options): Extension<Options>,
    Path(content_id): Path<i32>,
    Json(req): Json<ContentValue>,
) -> Result<(), HttpError> {
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
        .execute(&mut conn)
        .await?;

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
