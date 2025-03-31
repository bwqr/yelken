use axum::{
    extract::{Path, State},
    Json,
};
use base::{models::Role, responses::HttpError, schema::roles, AppState};
use diesel::{
    prelude::*,
    result::{DatabaseErrorKind, Error},
};
use diesel_async::RunQueryDsl;

use crate::{requests::CreateRole, responses::CreatedRole};

pub async fn create_role(
    State(state): State<AppState>,
    Json(req): Json<CreateRole>,
) -> Result<Json<CreatedRole>, HttpError> {
    let role = diesel::insert_into(roles::table)
        .values(roles::name.eq(req.name))
        .get_result::<Role>(&mut state.pool.get().await?)
        .await?;

    Ok(Json(CreatedRole {
        id: role.id,
        name: role.name,
    }))
}

pub async fn delete_role(
    State(state): State<AppState>,
    Path(role_id): Path<i32>,
) -> Result<(), HttpError> {
    let effected_row: usize = diesel::delete(roles::table)
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

#[cfg(test)]
mod tests {}
