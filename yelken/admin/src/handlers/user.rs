use std::str::FromStr;

use axum::{
    extract::{Path, State},
    Extension, Json,
};
use base::{
    crypto::Crypto,
    middlewares::{auth::AuthUser, permission::Permission},
    models::{User, UserState},
    responses::HttpError,
    schema::{permissions, users},
    AppState,
};
use diesel::{
    prelude::*,
    result::{DatabaseErrorKind, Error},
};
use diesel_async::RunQueryDsl;
use rand::{distr::Alphanumeric, rng, Rng};

use crate::{
    requests::{CreateUser, UpdateUser},
    responses::{self, CreatedUser, UserDetail},
};

fn generate_username(name: &str) -> String {
    name.chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .collect::<String>()
        + "_"
        + (0..12)
            .map(|_| rng().sample(Alphanumeric) as char)
            .collect::<String>()
            .as_str()
}

pub async fn fetch_users(
    State(state): State<AppState>,
) -> Result<Json<Vec<responses::User>>, HttpError> {
    users::table
        .select((
            users::id,
            users::role_id,
            users::username,
            users::name,
            users::state,
        ))
        .order(users::id.asc())
        .load::<(i32, Option<i32>, String, String, UserState)>(&mut state.pool.get().await?)
        .await
        .map(|users| {
            Json(
                users
                    .into_iter()
                    .map(|user| responses::User {
                        id: user.0,
                        role_id: user.1,
                        username: user.2,
                        name: user.3,
                        state: user.4,
                    })
                    .collect(),
            )
        })
        .map_err(Into::into)
}

pub async fn fetch_user(
    State(state): State<AppState>,
    Path(username): Path<String>,
) -> Result<Json<UserDetail>, HttpError> {
    let mut conn = state.pool.get().await?;

    let (user, email) = users::table
        .filter(users::username.eq(username))
        .select((
            users::id,
            users::role_id,
            users::username,
            users::name,
            users::state,
            users::email,
        ))
        .first::<(i32, Option<i32>, String, String, UserState, String)>(&mut conn)
        .await
        .map(|user| {
            (
                responses::User {
                    id: user.0,
                    role_id: user.1,
                    username: user.2,
                    name: user.3,
                    state: user.4,
                },
                user.5,
            )
        })?;

    let perms = permissions::table
        .filter(permissions::user_id.eq(user.id))
        .select(permissions::key)
        .load::<String>(&mut conn)
        .await?;

    Ok(Json(UserDetail {
        user,
        email,
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

pub async fn create_user(
    State(state): State<AppState>,
    Extension(crypto): Extension<Crypto>,
    Json(req): Json<CreateUser>,
) -> Result<Json<CreatedUser>, HttpError> {
    let salt: String = (0..32)
        .map(|_| rng().sample(Alphanumeric) as char)
        .collect();

    let password = crypto.sign512((req.password + salt.as_str()).as_bytes());

    let mut conn = state.pool.get().await?;

    let user = diesel::insert_into(users::table)
        .values((
            users::username.eq(generate_username(&req.name)),
            users::name.eq(&req.name),
            users::email.eq(&req.email),
            users::password.eq(salt + password.as_str()),
        ))
        .get_result::<User>(&mut conn)
        .await
        .map_err(|e| {
            if let Error::DatabaseError(DatabaseErrorKind::UniqueViolation, info) = &e {
                if let Some(constraint_name) = info.constraint_name() {
                    if constraint_name.contains("email") {
                        return HttpError::conflict("email_already_exists");
                    } else if constraint_name.contains("username") {
                        return HttpError::conflict("non_unique_username");
                    }
                };
            }

            e.into()
        })?;

    Ok(Json(CreatedUser {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
    }))
}

pub async fn update_user(
    State(state): State<AppState>,
    Path(user_id): Path<i32>,
    user: AuthUser,
    Json(req): Json<UpdateUser>,
) -> Result<(), HttpError> {
    if user_id == user.id {
        return Err(HttpError::conflict("self_update_not_possible"));
    }

    let effected_row = diesel::update(users::table)
        .filter(users::id.eq(user_id))
        .set((
            users::name.eq(req.name),
            users::role_id.eq(req.role_id),
            users::state.eq(req.state),
        ))
        .execute(&mut state.pool.get().await?)
        .await
        .map_err(|e| {
            if let Error::DatabaseError(DatabaseErrorKind::ForeignKeyViolation, _) = &e {
                return HttpError::conflict("role_not_found");
            }

            e.into()
        })?;

    if effected_row == 0 {
        return Err(HttpError::not_found("user_not_found"));
    }

    Ok(())
}

pub async fn delete_user(
    State(state): State<AppState>,
    Path(user_id): Path<i32>,
    user: AuthUser,
) -> Result<(), HttpError> {
    if user_id == user.id {
        return Err(HttpError::conflict("self_update_not_possible"));
    }

    let effected_row = diesel::delete(users::table)
        .filter(users::id.eq(user_id))
        .execute(&mut state.pool.get().await?)
        .await
        .map_err(|e| {
            if let Error::DatabaseError(DatabaseErrorKind::ForeignKeyViolation, _) = &e {
                return HttpError::conflict("user_being_used");
            }

            e.into()
        })?;

    if effected_row == 0 {
        return Err(HttpError::not_found("user_not_found"));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use axum::{
        extract::{Path, State},
        Extension, Json,
    };
    use base::{
        config::Config,
        crypto::Crypto,
        middlewares::auth::AuthUser,
        models::{User, UserState},
        schema::{roles, users},
        test::{create_pool, DB_CONFIG},
        AppState,
    };
    use chrono::NaiveDateTime;
    use diesel::prelude::*;
    use diesel_async::RunQueryDsl;

    use crate::requests::CreateUser;

    use super::{create_user, update_user_role, update_user_state};

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

        let service = opendal::services::Memory::default();
        let storage = opendal::Operator::new(service).unwrap().finish();

        (AppState::new(config, pool, storage), auth_user)
    }

    #[tokio::test]
    async fn it_creates_a_new_user() {
        let (state, _) = init_state().await;

        let crypto = Crypto::new("secret");

        let req = CreateUser {
            name: "Merhabalar".to_string(),
            email: "merhaba@email.com".to_string(),
            password: "password".to_string(),
        };

        let created_user = create_user(State(state.clone()), Extension(crypto), Json(req))
            .await
            .unwrap();

        assert_eq!("Merhabalar", created_user.name);
        assert_eq!("merhaba@email.com", created_user.email);

        let created_user = users::table
            .filter(users::id.eq(created_user.id))
            .first::<User>(&mut state.pool.get().await.unwrap())
            .await
            .unwrap();

        assert_eq!(UserState::Enabled, created_user.state);
    }

    #[tokio::test]
    async fn it_disables_given_user() {
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

        update_user_state(
            State(state.clone()),
            Path(user.id),
            auth_user,
            Json(UserState::Disabled),
        )
        .await
        .unwrap();

        let state = users::table
            .filter(users::id.eq(user.id))
            .select(users::state)
            .first::<UserState>(&mut state.pool.get().await.unwrap())
            .await
            .unwrap();

        assert_eq!(UserState::Disabled, state);
    }

    #[tokio::test]
    async fn it_updates_user_role() {
        let (state, auth_user) = init_state().await;

        let role = diesel::insert_into(roles::table)
            .values(roles::name.eq("admin"))
            .get_result::<(i32, String, NaiveDateTime)>(&mut state.pool.get().await.unwrap())
            .await
            .unwrap();

        let user = diesel::insert_into(users::table)
            .values((
                users::username.eq("username1"),
                users::name.eq("name"),
                users::email.eq("email1"),
                users::password.eq("password"),
                users::salt.eq("salt"),
                users::role_id.eq(Option::<i32>::None),
            ))
            .get_result::<User>(&mut state.pool.get().await.unwrap())
            .await
            .unwrap();

        update_user_role(
            State(state.clone()),
            Path(user.id),
            auth_user,
            Json(Some(role.0)),
        )
        .await
        .unwrap();

        let role_id = users::table
            .filter(users::id.eq(user.id))
            .select(users::role_id)
            .first::<Option<i32>>(&mut state.pool.get().await.unwrap())
            .await
            .unwrap();

        assert_eq!(Some(role.0), role_id);
    }

    #[tokio::test]
    async fn it_enables_given_user() {
        let (state, auth_user) = init_state().await;

        let user = diesel::insert_into(users::table)
            .values((
                users::username.eq("username1"),
                users::name.eq("name"),
                users::email.eq("email1"),
                users::password.eq("password"),
                users::salt.eq("salt"),
                users::state.eq(UserState::Disabled),
            ))
            .get_result::<User>(&mut state.pool.get().await.unwrap())
            .await
            .unwrap();

        update_user_state(
            State(state.clone()),
            Path(user.id),
            auth_user,
            Json(UserState::Enabled),
        )
        .await
        .unwrap();

        let state = users::table
            .filter(users::id.eq(user.id))
            .select(users::state)
            .first::<UserState>(&mut state.pool.get().await.unwrap())
            .await
            .unwrap();

        assert_eq!(UserState::Enabled, state);
    }

    #[tokio::test]
    async fn it_does_not_update_another_user_state() {
        let (state, auth_user) = init_state().await;

        let user = diesel::insert_into(users::table)
            .values((
                users::username.eq("username1"),
                users::name.eq("name"),
                users::email.eq("email1"),
                users::password.eq("password"),
                users::salt.eq("salt"),
                users::state.eq(UserState::Enabled),
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
                users::state.eq(UserState::Enabled),
            ))
            .get_result::<User>(&mut state.pool.get().await.unwrap())
            .await
            .unwrap();

        update_user_state(
            State(state.clone()),
            Path(user.id),
            auth_user,
            Json(UserState::Disabled),
        )
        .await
        .unwrap();

        let another_user_state = users::table
            .filter(users::id.eq(another_user.id))
            .select(users::state)
            .first::<UserState>(&mut state.pool.get().await.unwrap())
            .await
            .unwrap();

        assert_eq!(UserState::Enabled, another_user_state);
    }

    #[tokio::test]
    async fn it_prevents_users_disabling_themselves() {
        let (state, auth_user) = init_state().await;

        let resp = update_user_state(
            State(state),
            Path(auth_user.id),
            auth_user,
            Json(UserState::Disabled),
        )
        .await;

        assert!(resp.is_err());

        let resp = resp.unwrap_err();

        assert_eq!(409, resp.code);

        assert_eq!("self_update_not_possible", resp.error);
    }

    #[tokio::test]
    async fn it_returns_user_not_found_error_if_given_user_id_does_not_exist() {
        let (state, auth_user) = init_state().await;

        let unknown_user_id = auth_user.id + 10;

        let resp = update_user_state(
            State(state),
            Path(unknown_user_id),
            auth_user,
            Json(UserState::Disabled),
        )
        .await;

        assert!(resp.is_err());

        let resp = resp.unwrap_err();

        assert_eq!(404, resp.code);

        assert_eq!("user_not_found", resp.error);
    }
}
