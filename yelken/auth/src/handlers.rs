use axum::{
    extract::{Json as ExtJson, State},
    http::StatusCode,
    response::Json as RespJson,
    Extension,
};
use base::{
    crypto::Crypto,
    models::{User, UserState},
    responses::HttpError,
    schema::users,
    AppState,
};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use rand::{distr::Alphanumeric, rng, Rng};

use shared::auth::{Login, Token};

pub async fn login(
    State(state): State<AppState>,
    crypto: Extension<Crypto>,
    ExtJson(request): ExtJson<Login>,
) -> Result<RespJson<Token>, HttpError> {
    const INVALID_CREDENTIALS: HttpError = HttpError {
        code: StatusCode::UNAUTHORIZED,
        error: "invalid_credentials",
        context: None,
    };

    let Some((user_id, password, salt, user_state)) = users::table
        .filter(users::email.eq(&request.email))
        .select((users::id, users::password, users::salt, users::state))
        .first::<(i32, String, String, UserState)>(&mut state.pool.get().await?)
        .await
        .optional()?
    else {
        return Err(INVALID_CREDENTIALS);
    };

    // TODO use verify
    if crypto.sign512((request.password + salt.as_str()).as_bytes()) != password {
        return Err(INVALID_CREDENTIALS);
    }

    if UserState::Enabled != user_state {
        return Err(HttpError {
            code: StatusCode::UNAUTHORIZED,
            error: "user_not_enabled",
            context: None,
        });
    }

    Ok(RespJson(Token {
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
    ExtJson(request): ExtJson<SignUp>,
) -> Result<RespJson<Token>, HttpError> {
    let salt: String = (0..32)
        .map(|_| rng().sample(Alphanumeric) as char)
        .collect();
    let password = crypto.sign512((request.password + salt.as_str()).as_bytes());

    let mut conn = state.pool.get().await?;

    let user_id = diesel::insert_into(users::table)
        .values((
            users::username.eq(generate_username(&request.name)),
            users::name.eq(&request.name),
            users::email.eq(&request.email),
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
                        return HttpError::conflict("email_already_exists");
                    } else if constraint_name.contains("username") {
                        return HttpError::conflict("non_unique_username");
                    }
                };
            }

            e.into()
        })?
        .id;

    Ok(RespJson(Token {
        token: crypto.encode(&base::middlewares::auth::Token::new(user_id))?,
    }))
}

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
