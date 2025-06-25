use crate::{
    requests::{CreateModel, CreateModelField, UpdateModel, UpdateModelField},
    responses::Model,
};
use axum::{
    extract::{Path, State},
    Json,
};
use base::{
    db::BatchQuery,
    models::ModelField,
    responses::HttpError,
    schema::{model_fields, models, themes},
    AppState,
};
use diesel::{
    prelude::*,
    result::{DatabaseErrorKind, Error},
};
use diesel_async::{scoped_futures::ScopedFutureExt, AsyncConnection, RunQueryDsl};

pub async fn fetch_models(State(state): State<AppState>) -> Result<Json<Vec<Model>>, HttpError> {
    let mut conn = state.pool.get().await?;

    let models = models::table
        .order(models::id.asc())
        .load::<base::models::Model>(&mut conn)
        .await?;

    let mut model_fields = model_fields::table
        .order(model_fields::id.asc())
        .load::<base::models::ModelField>(&mut conn)
        .await?;

    Ok(Json(
        models
            .into_iter()
            .map(|m| {
                let fields = model_fields
                    .extract_if(.., |mf| mf.model_id == m.id)
                    .collect();

                Model { model: m, fields }
            })
            .collect(),
    ))
}

pub async fn create_model(
    State(state): State<AppState>,
    Json(req): Json<CreateModel>,
) -> Result<Json<Model>, HttpError> {
    let mut conn = state.pool.get().await?;

    let exists = if let Some(namespace) = &req.namespace {
        let theme = themes::table
            .filter(themes::id.eq(namespace))
            .select(themes::id)
            .first::<String>(&mut conn)
            .await
            .optional()?
            .ok_or_else(|| HttpError::not_found("namespace_not_found"))?;

        diesel::dsl::select(diesel::dsl::exists(
            models::table.filter(models::namespace.eq(theme).and(models::key.eq(&req.key))),
        ))
        .get_result::<bool>(&mut conn)
        .await
    } else {
        diesel::dsl::select(diesel::dsl::exists(
            models::table.filter(models::namespace.is_null().and(models::key.eq(&req.key))),
        ))
        .get_result::<bool>(&mut conn)
        .await
    };

    if exists? {
        return Err(HttpError::conflict("model_already_exists"));
    }

    let (model, fields) = conn
        .transaction(|conn| {
            async move {
                let model = diesel::insert_into(models::table)
                    .values((
                        models::namespace.eq(req.namespace),
                        models::key.eq(req.key),
                        models::name.eq(req.name),
                        models::desc.eq(req.desc),
                    ))
                    .get_result::<base::models::Model>(conn)
                    .await?;

                let model_fields = diesel::insert_into(model_fields::table)
                    .values(
                        req.model_fields
                            .into_iter()
                            .map(|mf| {
                                (
                                    model_fields::field_id.eq(mf.field_id),
                                    model_fields::model_id.eq(model.id),
                                    model_fields::key.eq(mf.key),
                                    model_fields::name.eq(mf.name),
                                    model_fields::desc.eq(mf.desc),
                                    model_fields::localized.eq(mf.localized),
                                    model_fields::multiple.eq(mf.multiple),
                                    model_fields::required.eq(mf.required),
                                )
                            })
                            .collect::<Vec<_>>(),
                    )
                    .batched()
                    .get_results::<base::models::ModelField>(conn)
                    .await?;

                Result::<(base::models::Model, Vec<base::models::ModelField>), HttpError>::Ok((
                    model,
                    model_fields,
                ))
            }
            .scope_boxed()
        })
        .await?;

    Ok(Json(Model { model, fields }))
}

pub async fn update_model(
    State(state): State<AppState>,
    Path(model_id): Path<i32>,
    Json(req): Json<UpdateModel>,
) -> Result<(), HttpError> {
    let effected_row: usize = diesel::update(models::table)
        .filter(models::id.eq(model_id))
        .set((models::name.eq(req.name), models::desc.eq(req.desc)))
        .execute(&mut state.pool.get().await?)
        .await?;

    if effected_row == 0 {
        return Err(HttpError::not_found("model_not_found"));
    }

    Ok(())
}

pub async fn delete_model(
    State(state): State<AppState>,
    Path(model_id): Path<i32>,
) -> Result<(), HttpError> {
    let effected_row: usize = diesel::delete(models::table)
        .filter(models::id.eq(model_id))
        .execute(&mut state.pool.get().await?)
        .await
        .map_err(|e| {
            if let Error::DatabaseError(DatabaseErrorKind::ForeignKeyViolation, _) = &e {
                return HttpError::conflict("model_being_used");
            }

            e.into()
        })?;

    if effected_row == 0 {
        return Err(HttpError::not_found("model_not_found"));
    }

    Ok(())
}

pub async fn create_model_field(
    State(state): State<AppState>,
    Path(model_id): Path<i32>,
    Json(req): Json<CreateModelField>,
) -> Result<Json<ModelField>, HttpError> {
    diesel::insert_into(model_fields::table)
        .values((
            model_fields::field_id.eq(req.field_id),
            model_fields::model_id.eq(model_id),
            model_fields::key.eq(req.key),
            model_fields::name.eq(req.name),
            model_fields::desc.eq(req.desc),
            model_fields::localized.eq(req.localized),
            model_fields::multiple.eq(req.multiple),
            model_fields::required.eq(req.required),
        ))
        .get_result::<ModelField>(&mut state.pool.get().await?)
        .await
        .map(Json)
        .map_err(|e| match e {
            Error::DatabaseError(DatabaseErrorKind::ForeignKeyViolation, ref info) => {
                if let Some(name) = info.constraint_name() {
                    if name.contains("model_id") {
                        return HttpError::conflict("model_not_found");
                    } else if name.contains("field_id") {
                        return HttpError::conflict("field_not_found");
                    }
                }

                return e.into();
            }
            Error::DatabaseError(DatabaseErrorKind::UniqueViolation, _) => {
                HttpError::conflict("model_field_already_exists")
            }
            e => e.into(),
        })
}

pub async fn update_model_field(
    State(state): State<AppState>,
    Path(model_field_id): Path<i32>,
    Json(req): Json<UpdateModelField>,
) -> Result<(), HttpError> {
    let effected_row: usize = diesel::update(model_fields::table)
        .filter(model_fields::id.eq(model_field_id))
        .set((
            model_fields::name.eq(req.name),
            model_fields::desc.eq(req.desc),
            model_fields::localized.eq(req.localized),
            model_fields::required.eq(req.required),
            model_fields::multiple.eq(req.multiple),
        ))
        .execute(&mut state.pool.get().await?)
        .await?;

    if effected_row == 0 {
        return Err(HttpError::not_found("model_field_not_found"));
    }

    Ok(())
}

pub async fn delete_model_field(
    State(state): State<AppState>,
    Path(model_field_id): Path<i32>,
) -> Result<(), HttpError> {
    let effected_row: usize = diesel::delete(model_fields::table)
        .filter(model_fields::id.eq(model_field_id))
        .execute(&mut state.pool.get().await?)
        .await?;

    if effected_row == 0 {
        return Err(HttpError::not_found("model_field_not_found"));
    }

    Ok(())
}
