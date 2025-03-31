use std::str::FromStr;

use axum::{
    extract::{Path, State},
    Json,
};
use base::{
    middlewares::auth::AuthUser,
    responses::HttpError,
    schema::{permissions, roles, users},
    AppState,
};
use diesel::prelude::*;
use diesel_async::{scoped_futures::ScopedFutureExt, AsyncConnection, RunQueryDsl};
use shared::permission::Permission;

pub async fn update_role_permissions(
    State(state): State<AppState>,
    Path(role_id): Path<i32>,
    perms: Json<Vec<String>>,
) -> Result<(), HttpError> {
    let perms: Result<Vec<Permission>, &'static str> = perms
        .0
        .into_iter()
        .map(|perm| Permission::from_str(&perm))
        .collect();

    let perms = perms.map_err(|_| HttpError::unprocessable_entity("unknown_permission"))?;

    state
        .pool
        .get()
        .await?
        .transaction(|conn| {
            async move {
                let Some(role_id) = roles::table
                    .filter(roles::id.eq(role_id))
                    .select(roles::id)
                    .first::<i32>(conn)
                    .await
                    .optional()?
                else {
                    return Err(HttpError::not_found("role_not_found"));
                };

                diesel::delete(permissions::table)
                    .filter(permissions::role_id.eq(role_id))
                    .execute(conn)
                    .await?;

                let perms = perms
                    .into_iter()
                    .map(|perm| {
                        (
                            permissions::role_id.eq(role_id),
                            permissions::name.eq(perm.as_str()),
                        )
                    })
                    .collect::<Vec<_>>();

                if perms.len() > 0 {
                    diesel::insert_into(permissions::table)
                        .values(perms)
                        .execute(conn)
                        .await?;
                }

                Result::<(), HttpError>::Ok(())
            }
            .scope_boxed()
        })
        .await?;

    Ok(())
}

pub async fn update_user_permissions(
    State(state): State<AppState>,
    Path(user_id): Path<i32>,
    user: AuthUser,
    perms: Json<Vec<String>>,
) -> Result<(), HttpError> {
    // Only admins are allowed to update a user's permission.
    // Since they are admin, they do not need update their own permissions.
    if user_id == user.id {
        return Err(HttpError::conflict("self_update_not_possible"));
    }

    let perms: Result<Vec<Permission>, &'static str> = perms
        .0
        .into_iter()
        .map(|perm| Permission::from_str(&perm))
        .collect();

    let perms = perms.map_err(|_| HttpError::unprocessable_entity("unknown_permission"))?;

    state
        .pool
        .get()
        .await?
        .transaction(|conn| {
            async move {
                let Some(user_id) = users::table
                    .filter(users::id.eq(user_id))
                    .select(users::id)
                    .first::<i32>(conn)
                    .await
                    .optional()?
                else {
                    return Err(HttpError::not_found("user_not_found"));
                };

                diesel::delete(permissions::table)
                    .filter(permissions::user_id.eq(user_id))
                    .execute(conn)
                    .await?;

                let perms = perms
                    .into_iter()
                    .map(|perm| {
                        (
                            permissions::user_id.eq(user_id),
                            permissions::name.eq(perm.as_str()),
                        )
                    })
                    .collect::<Vec<_>>();

                if perms.len() > 0 {
                    diesel::insert_into(permissions::table)
                        .values(perms)
                        .execute(conn)
                        .await?;
                }

                Result::<(), HttpError>::Ok(())
            }
            .scope_boxed()
        })
        .await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use axum::{
        extract::{Path, State},
        Json,
    };
    use base::{
        config::Config,
        middlewares::auth::AuthUser,
        models::User,
        schema::{permissions, roles, users},
        test::{create_pool, DB_CONFIG},
        AppState,
    };
    use chrono::NaiveDateTime;
    use diesel::prelude::*;
    use diesel_async::RunQueryDsl;

    use super::{update_role_permissions, update_user_permissions};

    async fn init_state() -> (AppState, AuthUser) {
        let config = Config::default();
        let pool = create_pool(DB_CONFIG).await;

        let auth_user = diesel::insert_into(users::table)
            .values((
                users::username.eq("username"),
                users::name.eq("name"),
                users::email.eq("email"),
                users::password.eq("password"),
                users::salt.eq("salt"),
            ))
            .get_result::<User>(&mut pool.get().await.unwrap())
            .await
            .unwrap();

        let auth_user = AuthUser {
            id: auth_user.id,
            name: auth_user.name,
        };

        (AppState::new(config, pool), auth_user)
    }

    #[tokio::test]
    async fn it_updates_user_permissions_with_given_ones() {
        let (state, auth_user) = init_state().await;

        let user = diesel::insert_into(users::table)
            .values((
                users::username.eq("username1"),
                users::name.eq("name"),
                users::email.eq("email1"),
                users::password.eq("password"),
                users::salt.eq("salt"),
            ))
            .get_result::<User>(&mut state.pool.get().await.unwrap())
            .await
            .unwrap();

        diesel::insert_into(permissions::table)
            .values([
                (
                    permissions::user_id.eq(user.id),
                    permissions::name.eq("content.read"),
                ),
                (
                    permissions::user_id.eq(user.id),
                    permissions::name.eq("self.read"),
                ),
            ])
            .execute(&mut state.pool.get().await.unwrap())
            .await
            .unwrap();

        update_user_permissions(
            State(state.clone()),
            Path(user.id),
            auth_user,
            Json(vec!["content.write".to_string()]),
        )
        .await
        .unwrap();

        let perms = permissions::table
            .filter(permissions::user_id.eq(user.id))
            .select((permissions::user_id, permissions::name))
            .load::<(Option<i32>, String)>(&mut state.pool.get().await.unwrap())
            .await
            .unwrap();

        assert_eq!(1, perms.len());
        assert_eq!(Some(user.id), perms[0].0);
        assert_eq!("content.write", perms[0].1);
    }

    #[tokio::test]
    async fn it_updates_role_permissions_with_given_ones() {
        let (state, _) = init_state().await;

        let role = diesel::insert_into(roles::table)
            .values(roles::name.eq("role1"))
            .get_result::<(i32, String, NaiveDateTime)>(&mut state.pool.get().await.unwrap())
            .await
            .unwrap();

        diesel::insert_into(permissions::table)
            .values([
                (
                    permissions::role_id.eq(role.0),
                    permissions::name.eq("content.read"),
                ),
                (
                    permissions::role_id.eq(role.0),
                    permissions::name.eq("self.read"),
                ),
            ])
            .execute(&mut state.pool.get().await.unwrap())
            .await
            .unwrap();

        update_role_permissions(
            State(state.clone()),
            Path(role.0),
            Json(vec!["content.write".to_string()]),
        )
        .await
        .unwrap();

        let perms = permissions::table
            .filter(permissions::role_id.eq(role.0))
            .select((permissions::role_id, permissions::name))
            .load::<(Option<i32>, String)>(&mut state.pool.get().await.unwrap())
            .await
            .unwrap();

        assert_eq!(1, perms.len());
        assert_eq!(Some(role.0), perms[0].0);
        assert_eq!("content.write", perms[0].1);
    }

    #[tokio::test]
    async fn it_returns_unknown_permission_when_given_permission_does_not_exist() {
        let (state, auth_user) = init_state().await;

        let resp = update_user_permissions(
            State(state.clone()),
            Path(auth_user.id + 1),
            auth_user,
            Json(vec!["invalid.permission".to_string()]),
        )
        .await;

        assert!(resp.is_err());

        let resp = resp.unwrap_err();

        assert_eq!(422, resp.code);
        assert_eq!("unknown_permission", resp.error);

        let resp = update_role_permissions(
            State(state.clone()),
            Path(1001),
            Json(vec!["invalid.permission".to_string()]),
        )
        .await;

        assert!(resp.is_err());

        let resp = resp.unwrap_err();

        assert_eq!(422, resp.code);
        assert_eq!("unknown_permission", resp.error);
    }

    #[tokio::test]
    async fn it_does_not_update_another_users_permissions() {
        let (state, auth_user) = init_state().await;

        let user = diesel::insert_into(users::table)
            .values((
                users::username.eq("username1"),
                users::name.eq("name"),
                users::email.eq("email1"),
                users::password.eq("password"),
                users::salt.eq("salt"),
            ))
            .get_result::<User>(&mut state.pool.get().await.unwrap())
            .await
            .unwrap();

        let another_user = diesel::insert_into(users::table)
            .values((
                users::username.eq("username2"),
                users::name.eq("name"),
                users::email.eq("email2"),
                users::password.eq("password"),
                users::salt.eq("salt"),
            ))
            .get_result::<User>(&mut state.pool.get().await.unwrap())
            .await
            .unwrap();

        diesel::insert_into(permissions::table)
            .values((
                permissions::user_id.eq(another_user.id),
                permissions::name.eq("content.read"),
            ))
            .execute(&mut state.pool.get().await.unwrap())
            .await
            .unwrap();

        update_user_permissions(State(state.clone()), Path(user.id), auth_user, Json(vec![]))
            .await
            .unwrap();

        let perms = permissions::table
            .filter(permissions::user_id.eq(another_user.id))
            .select((permissions::user_id, permissions::name))
            .load::<(Option<i32>, String)>(&mut state.pool.get().await.unwrap())
            .await
            .unwrap();

        assert_eq!(1, perms.len());
        assert_eq!(Some(another_user.id), perms[0].0);
        assert_eq!("content.read", perms[0].1);
    }

    #[tokio::test]
    async fn it_does_not_update_another_roles_permissions() {
        let (state, _) = init_state().await;

        let role = diesel::insert_into(roles::table)
            .values(roles::name.eq("role1"))
            .get_result::<(i32, String, NaiveDateTime)>(&mut state.pool.get().await.unwrap())
            .await
            .unwrap();

        let another_role = diesel::insert_into(roles::table)
            .values(roles::name.eq("role2"))
            .get_result::<(i32, String, NaiveDateTime)>(&mut state.pool.get().await.unwrap())
            .await
            .unwrap();

        diesel::insert_into(permissions::table)
            .values((
                permissions::role_id.eq(another_role.0),
                permissions::name.eq("content.read"),
            ))
            .execute(&mut state.pool.get().await.unwrap())
            .await
            .unwrap();

        update_role_permissions(State(state.clone()), Path(role.0), Json(vec![]))
            .await
            .unwrap();

        let perms = permissions::table
            .filter(permissions::role_id.eq(another_role.0))
            .select((permissions::role_id, permissions::name))
            .load::<(Option<i32>, String)>(&mut state.pool.get().await.unwrap())
            .await
            .unwrap();

        assert_eq!(1, perms.len());
        assert_eq!(Some(another_role.0), perms[0].0);
        assert_eq!("content.read", perms[0].1);
    }

    #[tokio::test]
    async fn it_prevents_users_updating_their_permissions_themselves() {
        let (state, auth_user) = init_state().await;

        let resp =
            update_user_permissions(State(state), Path(auth_user.id), auth_user, Json(vec![]))
                .await;

        assert!(resp.is_err());

        let resp = resp.unwrap_err();

        assert_eq!(409, resp.code);

        assert_eq!("self_update_not_possible", resp.error);
    }

    #[tokio::test]
    async fn it_returns_user_not_found_error_when_user_does_not_exist() {
        let (state, auth_user) = init_state().await;

        let unknown_user_id = auth_user.id + 10;

        let resp =
            update_user_permissions(State(state), Path(unknown_user_id), auth_user, Json(vec![]))
                .await;

        assert!(resp.is_err());

        let resp = resp.unwrap_err();

        assert_eq!(404, resp.code);

        assert_eq!("user_not_found", resp.error);
    }

    #[tokio::test]
    async fn it_returns_role_not_found_error_when_role_does_not_exist() {
        let (state, _) = init_state().await;

        let unknown_role_id = 1001;

        let resp = update_role_permissions(State(state), Path(unknown_role_id), Json(vec![])).await;

        assert!(resp.is_err());

        let resp = resp.unwrap_err();

        assert_eq!(404, resp.code);

        assert_eq!("role_not_found", resp.error);
    }
}
