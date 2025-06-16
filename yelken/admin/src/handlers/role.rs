use std::str::FromStr;

use axum::{
    extract::{Path, State},
    Json,
};
use base::{
    middlewares::permission::Permission,
    models::Role,
    responses::HttpError,
    schema::{permissions, roles},
    AppState,
};
use diesel::{
    prelude::*,
    result::{DatabaseErrorKind, Error},
};
use diesel_async::RunQueryDsl;

use crate::{requests::CreateRole, responses::RoleDetail};

pub async fn fetch_roles(State(state): State<AppState>) -> Result<Json<Vec<Role>>, HttpError> {
    roles::table
        .load::<Role>(&mut state.pool.get().await?)
        .await
        .map(Json)
        .map_err(Into::into)
}

pub async fn fetch_role(
    State(state): State<AppState>,
    Path(role_id): Path<i32>,
) -> Result<Json<RoleDetail>, HttpError> {
    let mut conn = state.pool.get().await?;

    let role = roles::table
        .filter(roles::id.eq(role_id))
        .first::<Role>(&mut conn)
        .await?;

    let perms = permissions::table
        .filter(permissions::role_id.eq(role_id))
        .select(permissions::key)
        .load::<String>(&mut conn)
        .await?;

    Ok(Json(RoleDetail {
        role,
        permissions: perms
            .into_iter()
            .flat_map(|perm| {
                Permission::from_str(&perm)
                    .inspect_err(|e| log::error!("Invalid permission found {perm} {e}"))
                    .ok()
            })
            .collect(),
    }))
}

pub async fn create_role(
    State(state): State<AppState>,
    Json(req): Json<CreateRole>,
) -> Result<Json<Role>, HttpError> {
    diesel::insert_into(roles::table)
        .values((
            roles::key.eq(req.key),
            roles::name.eq(req.name),
            roles::desc.eq(req.desc),
        ))
        .get_result::<Role>(&mut state.pool.get().await?)
        .await
        .map(Json)
        .map_err(|e| {
            if let Error::DatabaseError(DatabaseErrorKind::UniqueViolation, _) = &e {
                return HttpError::conflict("already_exists");
            }

            e.into()
        })
}

pub async fn delete_role(
    State(state): State<AppState>,
    Path(role_id): Path<i32>,
) -> Result<(), HttpError> {
    let effected_row = diesel::delete(roles::table)
        .filter(roles::id.eq(role_id))
        .execute(&mut state.pool.get().await?)
        .await
        .map_err(|e| {
            if let Error::DatabaseError(DatabaseErrorKind::ForeignKeyViolation, _) = &e {
                return HttpError::conflict("role_being_used");
            }

            e.into()
        })?;

    if effected_row == 0 {
        return Err(HttpError::not_found("role_not_found"));
    }

    Ok(())
}
