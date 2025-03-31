use std::{error::Error, fmt};

use axum::{http::StatusCode, response::IntoResponse, Json};
use serde::{ser::SerializeStruct, Serialize};

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
        if let Some(context) = &self.context {
            state.serialize_field("context", context)?;
        }
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
