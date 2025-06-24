use std::str::FromStr;

use crate::responses::{User, UserWithPermissions};
use axum::{extract::State, Json};
use base::{
    middlewares::{auth::AuthUser, permission::Permission},
    responses::HttpError,
    schema::{permissions, users},
    AppState,
};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;

pub async fn fetch_profile(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<UserWithPermissions>, HttpError> {
    let mut conn = state.pool.get().await?;

    let user = users::table
        .filter(users::id.eq(user.id))
        .select((
            users::id,
            users::role_id,
            users::username,
            users::name,
            users::email,
            users::state,
            users::login_kind,
            users::created_at,
        ))
        .first::<User>(&mut conn)
        .await
        .optional()?
        .ok_or_else(|| HttpError::not_found("user_not_found"))?;

    let perms = permissions::table
        .filter(permissions::user_id.eq(user.id))
        .select(permissions::key)
        .load::<String>(&mut conn)
        .await?;

    Ok(Json(UserWithPermissions {
        user,
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
