use axum::{extract::State, http::StatusCode, Extension, Json};
use base::{
    crypto::Crypto,
    models::{LoginKind, User, UserState},
    responses::HttpError,
    schema::users,
    AppState,
};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use rand::{distr::Alphanumeric, rng, Rng};

use serde::{Deserialize, Serialize};

use super::generate_username;

const SALT_LENGTH: usize = 32;

#[derive(Deserialize, Serialize)]
pub(crate) struct Token {
    pub token: String,
}

#[derive(Deserialize, Serialize)]
pub(crate) struct Login {
    pub email: String,
    pub password: String,
}

pub async fn login(
    State(state): State<AppState>,
    crypto: Extension<Crypto>,
    Json(request): Json<Login>,
) -> Result<Json<Token>, HttpError> {
    const INVALID_CREDENTIALS: HttpError = HttpError {
        code: StatusCode::FORBIDDEN,
        error: "invalid_credentials",
        context: None,
    };

    let Some((user_id, login_kind, password, user_state)) = users::table
        .filter(users::email.eq(&request.email))
        .select((users::id, users::login_kind, users::password, users::state))
        .first::<(i32, LoginKind, Option<String>, UserState)>(&mut state.pool.get().await?)
        .await
        .optional()?
    else {
        return Err(INVALID_CREDENTIALS);
    };

    match login_kind {
        LoginKind::Email => {}
        _ => return Err(HttpError::conflict("user_not_created_with_email")),
    }

    let Some(password) = password else {
        return Err(HttpError::internal_server_error(
            "email_login_kind_has_null_password",
        ));
    };

    let Some((salt, password)) = password.split_at_checked(SALT_LENGTH) else {
        return Err(HttpError::internal_server_error(
            "invalid_password_and_salt",
        ));
    };

    // TODO use verify
    if crypto.sign512((request.password + salt).as_bytes()) != password {
        return Err(INVALID_CREDENTIALS);
    }

    if UserState::Enabled != user_state {
        return Err(HttpError {
            code: StatusCode::FORBIDDEN,
            error: "user_not_enabled",
            context: None,
        });
    }

    Ok(Json(Token {
        token: crypto.encode(&base::middlewares::auth::Token::new(user_id))?,
    }))
}

#[derive(serde::Deserialize)]
pub struct SignUp {
    pub name: String,
    pub email: String,
    pub password: String,
}

pub async fn sign_up(
    State(state): State<AppState>,
    crypto: Extension<Crypto>,
    Json(request): Json<SignUp>,
) -> Result<Json<Token>, HttpError> {
    let salt: String = (0..SALT_LENGTH)
        .map(|_| rng().sample(Alphanumeric) as char)
        .collect();
    let password = crypto.sign512((request.password + salt.as_str()).as_bytes());

    let mut conn = state.pool.get().await?;

    let user_id = diesel::insert_into(users::table)
        .values((
            users::username.eq(generate_username(&request.name)),
            users::name.eq(&request.name),
            users::email.eq(&request.email),
            users::password.eq(salt + password.as_str()),
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
                        return HttpError::conflict("email_already_exists");
                    } else if constraint_name.contains("username") {
                        return HttpError::conflict("non_unique_username");
                    }
                };
            }

            e.into()
        })?
        .id;

    Ok(Json(Token {
        token: crypto.encode(&base::middlewares::auth::Token::new(user_id))?,
    }))
}
