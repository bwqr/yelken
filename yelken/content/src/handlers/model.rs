use crate::requests::{CreateModel, Model, ModelField};
use axum::{extract::State, Extension, Json};
use base::{
    config::Options,
    db::BatchQuery,
    responses::HttpError,
    schema::{model_fields, models},
    AppState,
};
use diesel::prelude::*;
use diesel_async::{scoped_futures::ScopedFutureExt, AsyncConnection, RunQueryDsl};

pub async fn fetch_models(State(state): State<AppState>) -> Result<Json<Vec<Model>>, HttpError> {
    let mut conn = state.pool.get().await?;

    let models = models::table.load::<base::models::Model>(&mut conn).await?;

    let model_fields = model_fields::table
        .load::<base::models::ModelField>(&mut conn)
        .await?;

    Ok(Json(
        models
            .into_iter()
            .map(|m| Model {
                id: m.id,
                namespace: m.namespace,
                name: m.name,
                fields: model_fields
                    .iter()
                    .filter_map(|mf| {
                        (mf.model_id == m.id).then(|| ModelField {
                            id: mf.id,
                            field_id: mf.field_id,
                            model_id: mf.model_id,
                            name: mf.name.clone(),
                            localized: mf.localized,
                            multiple: mf.multiple,
                            required: mf.required,
                        })
                    })
                    .collect(),
            })
            .collect(),
    ))
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

    let (model, model_fields) = conn
        .transaction(|conn| {
            async move {
                let model = diesel::insert_into(models::table)
                    .values((
                        models::namespace.eq(req.theme_scoped.then_some(&*theme)),
                        models::name.eq(req.name),
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
                                    model_fields::name.eq(mf.name),
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

    Ok(Json(Model {
        id: model.id,
        namespace: model.namespace,
        name: model.name,
        fields: model_fields
            .into_iter()
            .map(|mf| ModelField {
                id: mf.id,
                field_id: mf.field_id,
                model_id: mf.model_id,
                name: mf.name.clone(),
                localized: mf.localized,
                multiple: mf.multiple,
                required: mf.required,
            })
            .collect(),
    }))
}
