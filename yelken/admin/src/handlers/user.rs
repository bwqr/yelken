use axum::{
    extract::{Json, Path, State},
    Extension,
};
use base::{
    crypto::Crypto,
    middlewares::auth::AuthUser,
    models::{User, UserState},
    responses::HttpError,
    schema::users,
    AppState,
};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use rand::{distr::Alphanumeric, rng, Rng};

use crate::{requests::CreateUser, responses::CreatedUser};

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

pub async fn create_user(
    State(state): State<AppState>,
    Extension(crypto): Extension<Crypto>,
    Json(req): Json<CreateUser>,
) -> Result<axum::response::Json<CreatedUser>, HttpError> {
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
            users::password.eq(password),
            users::salt.eq(salt),
        ))
        .get_result::<User>(&mut conn)
        .await
        .map_err(|e| {
            if let diesel::result::Error::DatabaseError(
                diesel::result::DatabaseErrorKind::UniqueViolation,
                info,
            ) = &e
            {
                if let Some(constraint_name) = info.constraint_name() {
                    if constraint_name.contains("email") {
                        return HttpError::conflict("email_already_used");
                    } else if constraint_name.contains("username") {
                        return HttpError::conflict("non_unique_username");
                    }
                };
            }

            e.into()
        })?;

    Ok(axum::response::Json(CreatedUser {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
    }))
}

pub async fn enable_user(
    State(state): State<AppState>,
    Path(user_id): Path<i32>,
) -> Result<(), HttpError> {
    let effected_row: usize = diesel::update(users::table)
        .filter(users::id.eq(user_id))
        .set(users::state.eq(UserState::Enabled))
        .execute(&mut state.pool.get().await?)
        .await?;

    if effected_row == 0 {
        return Err(HttpError::not_found("user_not_found"));
    }

    Ok(())
}

pub async fn disable_user(
    State(state): State<AppState>,
    Path(user_id): Path<i32>,
    user: AuthUser,
) -> Result<(), HttpError> {
    // Only admins are allowed to update a user's permission.
    // Since they are admin, they do not need update their own permissions.
    if user_id == user.id {
        return Err(HttpError::conflict("self_update_not_possible"));
    }

    let effected_row: usize = diesel::update(users::table)
        .filter(users::id.eq(user_id))
        .set(users::state.eq(UserState::Disabled))
        .execute(&mut state.pool.get().await?)
        .await?;

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
        schema::users,
        test::{create_pool, DB_CONFIG},
        AppState,
    };
    use diesel::prelude::*;
    use diesel_async::RunQueryDsl;

    use crate::requests::CreateUser;

    use super::{create_user, disable_user, enable_user};

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
            username: auth_user.username,
            name: auth_user.name,
            email: auth_user.email,
            created_at: auth_user.created_at,
        };

        (AppState::new(config, pool), auth_user)
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

        disable_user(State(state.clone()), Path(user.id), auth_user)
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
    async fn it_enables_given_user() {
        let (state, _) = init_state().await;

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

        enable_user(State(state.clone()), Path(user.id))
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
    async fn it_does_not_disable_another_user() {
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

        disable_user(State(state.clone()), Path(user.id), auth_user)
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
    async fn it_does_not_enable_another_user() {
        let (state, _) = init_state().await;

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

        let another_user = diesel::insert_into(users::table)
            .values((
                users::username.eq("username2"),
                users::name.eq("name"),
                users::email.eq("email2"),
                users::password.eq("password"),
                users::salt.eq("salt"),
                users::state.eq(UserState::Disabled),
            ))
            .get_result::<User>(&mut state.pool.get().await.unwrap())
            .await
            .unwrap();

        enable_user(State(state.clone()), Path(user.id))
            .await
            .unwrap();

        let another_user_state = users::table
            .filter(users::id.eq(another_user.id))
            .select(users::state)
            .first::<UserState>(&mut state.pool.get().await.unwrap())
            .await
            .unwrap();

        assert_eq!(UserState::Disabled, another_user_state);
    }

    #[tokio::test]
    async fn it_prevents_users_disabling_themselves() {
        let (state, auth_user) = init_state().await;

        let resp = disable_user(State(state), Path(auth_user.id), auth_user).await;

        assert!(resp.is_err());

        let resp = resp.unwrap_err();

        assert_eq!(409, resp.code);

        assert_eq!("self_update_not_possible", resp.error);
    }

    #[tokio::test]
    async fn it_returns_user_not_found_error_if_given_user_id_does_not_exist_when_disable_user_is_called(
    ) {
        let (state, auth_user) = init_state().await;

        let unknown_user_id = auth_user.id + 10;

        let resp = disable_user(State(state), Path(unknown_user_id), auth_user).await;

        assert!(resp.is_err());

        let resp = resp.unwrap_err();

        assert_eq!(404, resp.code);

        assert_eq!("user_not_found", resp.error);
    }

    #[tokio::test]
    async fn it_returns_user_not_found_error_if_given_user_id_does_not_exist_when_enable_user_is_called(
    ) {
        let (state, auth_user) = init_state().await;

        let unknown_user_id = auth_user.id + 10;

        let resp = enable_user(State(state), Path(unknown_user_id)).await;

        assert!(resp.is_err());

        let resp = resp.unwrap_err();

        assert_eq!(404, resp.code);

        assert_eq!("user_not_found", resp.error);
    }
}
