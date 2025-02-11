use axum::{
    extract::FromRequestParts,
    http::{request::Parts, StatusCode},
    response::IntoResponse,
    Json,
};
use chrono::{NaiveDateTime, Utc};
use core::fmt;
use serde::{ser::SerializeStruct, Deserialize, Serialize};
use std::error::Error;

#[derive(Clone, Deserialize, Serialize)]
pub struct Token {
    // issued at
    pub iat: i64,
    // expire time
    pub exp: i64,
    pub id: i32,
}

impl Token {
    pub fn new(id: i32) -> Token {
        const TIMEOUT: i64 = 60 * 60 * 24 * 7;

        let now = Utc::now().timestamp();

        Self {
            iat: now,
            exp: now + TIMEOUT,
            id,
        }
    }
}

#[derive(Debug)]
pub struct HttpError {
    pub code: StatusCode,
    pub error: &'static str,
    pub context: Option<String>,
}

impl Error for HttpError {}

impl fmt::Display for HttpError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&format!(
            "code {} error {} context {}",
            self.code,
            self.error,
            self.context.is_some()
        ))
    }
}

impl HttpError {
    pub const fn internal_server_error(error: &'static str) -> Self {
        HttpError {
            code: StatusCode::INTERNAL_SERVER_ERROR,
            error,
            context: None,
        }
    }

    pub const fn not_found(error: &'static str) -> Self {
        HttpError {
            code: StatusCode::NOT_FOUND,
            error,
            context: None,
        }
    }

    pub const fn conflict(error: &'static str) -> Self {
        HttpError {
            code: StatusCode::CONFLICT,
            error,
            context: None,
        }
    }

    pub const fn unprocessable_entity(error: &'static str) -> Self {
        HttpError {
            code: StatusCode::UNPROCESSABLE_ENTITY,
            error,
            context: None,
        }
    }

    pub fn with_context(mut self, context: String) -> Self {
        self.context = Some(context);
        self
    }
}

impl Serialize for HttpError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        // 2 is the number of fields in the struct.
        let mut state = serializer.serialize_struct("HttpError", 2)?;
        state.serialize_field("code", &StatusCode::as_u16(&self.code))?;
        state.serialize_field("error", &self.error)?;
        state.end()
    }
}

impl IntoResponse for HttpError {
    fn into_response(self) -> axum::response::Response {
        if self.code.as_u16() > 499 {
            log::error!("Internal server error {}", self.error);
        }

        if let Some(context) = &self.context {
            log::warn!("HttpError: {}", context);
        }

        (self.code, Json(self)).into_response()
    }
}

impl From<diesel_async::pooled_connection::bb8::RunError> for HttpError {
    fn from(e: diesel_async::pooled_connection::bb8::RunError) -> Self {
        log::error!("db pool error, {e:?}");

        HttpError {
            code: StatusCode::INTERNAL_SERVER_ERROR,
            error: "db_pool_error",
            context: None,
        }
    }
}

impl From<diesel::result::Error> for HttpError {
    fn from(e: diesel::result::Error) -> Self {
        if let diesel::result::Error::NotFound = e {
            return HttpError {
                code: StatusCode::NOT_FOUND,
                error: "item_not_found",
                context: None,
            };
        };

        log::error!("db error, {e:?}");

        HttpError {
            code: StatusCode::INTERNAL_SERVER_ERROR,
            error: "db_error",
            context: None,
        }
    }
}

impl From<jsonwebtoken::errors::Error> for HttpError {
    fn from(e: jsonwebtoken::errors::Error) -> Self {
        use jsonwebtoken::errors::ErrorKind::*;

        match e.kind() {
            ExpiredSignature => HttpError {
                code: StatusCode::UNAUTHORIZED,
                error: "expired_token",
                context: None,
            },
            InvalidSignature | InvalidToken => HttpError {
                code: StatusCode::UNAUTHORIZED,
                error: "invalid_token",
                context: None,
            },
            e => HttpError {
                code: StatusCode::INTERNAL_SERVER_ERROR,
                error: "crypto_error",
                context: Some(format!("crypto error, {:?}", e)),
            },
        }
    }
}

#[derive(Clone)]
pub struct AuthUser {
    pub id: i32,
    pub username: String,
    pub name: String,
    pub email: String,
    pub created_at: NaiveDateTime,
}

impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
{
    type Rejection = HttpError;

    async fn from_request_parts(parts: &mut Parts, _: &S) -> Result<Self, Self::Rejection> {
        match parts.extensions.remove::<Self>() {
            Some(user) => Ok(user),
            None => Err(HttpError {
                code: StatusCode::UNAUTHORIZED,
                error: "token_not_found_for_user",
                context: None,
            }),
        }
    }
}
