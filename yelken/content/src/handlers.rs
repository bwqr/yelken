use axum::{extract::State, Json};
use base::{
    responses::HttpError,
    schema::{fields, models},
    AppState,
};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use shared::content::{Field, Model};

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
        .select((models::id, models::name))
        .load::<(i32, String)>(&mut state.pool.get().await?)
        .await
        .map(|ms| {
            Json(
                ms.into_iter()
                    .map(|m| Model { id: m.0, name: m.1 })
                    .collect(),
            )
        })
        .map_err(Into::into)
}

// pub async fn create_model(
//     State(state): State<AppState>,
//     Json(req): Json<CreateModel>,
// ) -> Result<Json<ModelWithFields>, HttpError> {
//     let mut conn = state.pool.get().await?;

//     let (model, field_ids) = conn
//         .transaction(|conn| {
//             async move {
//                 let model = insert_into(models::table)
//                     .values(models::name.eq(req.name))
//                     .get_result::<(i32, String)>(conn)
//                     .await?;

//                 let model_fields = insert_into(model_fields::table)
//                     .values(
//                         req.model_fields
//                             .into_iter()
//                             .map(|mf| {
//                                 (
//                                     model_fields::field_id.eq(mf.0),
//                                     model_fields::model_id.eq(model.0),
//                                     model_fields::name.eq(mf.1),
//                                 )
//                             })
//                             .collect::<Vec<_>>(),
//                     )
//                     .get_results::<(i32, i32, i32, String)>(conn)
//                     .await?;

//                 Result::<(Model, Vec<i32>), HttpError>::Ok((
//                     Model {
//                         id: model.0,
//                         name: model.1,
//                     },
//                     model_fields.into_iter().map(|mf| mf.0).collect(),
//                 ))
//             }
//             .scope_boxed()
//         })
//         .await?;

//     let fields = fields::table
//         .select((fields::id, fields::name, fields::kind))
//         .filter(fields::id.eq_any(field_ids.iter()))
//         .load::<(i32, String, String)>(&mut conn)
//         .await?
//         .into_iter()
//         .map(|f| Field {
//             id: f.0,
//             name: f.1,
//             kind: f.2,
//         })
//         .collect();

//     Ok(Json(ModelWithFields { model, fields }))
// }
