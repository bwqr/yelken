use axum::{extract::State, http::StatusCode, Extension, Json};
use base::{
    crypto::Crypto,
    models::{LoginKind, UserState},
    responses::HttpError,
    schema::users,
    AppState,
};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;

use serde::{Deserialize, Serialize};

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
    if crypto.sign512(format!("{salt}{}", request.password).as_bytes()) != password {
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
