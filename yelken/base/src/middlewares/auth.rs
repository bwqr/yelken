use axum::{
    extract::{Request, State},
    http::{self, StatusCode},
    middleware::Next,
    response::Response,
};
use diesel::prelude::*;
use diesel_async::{pooled_connection::bb8::PooledConnection, AsyncPgConnection, RunQueryDsl};

use crate::{crypto::Crypto, models::UserState, responses::HttpError, schema::users, AppState};

use axum::{
    extract::{FromRequestParts, OptionalFromRequestParts},
    http::request::Parts,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};

const TOKEN_NOT_FOUND_ERROR: HttpError = HttpError {
    code: StatusCode::UNAUTHORIZED,
    error: "token_not_found",
    context: None,
};

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

#[derive(Clone)]
pub struct AuthUser {
    pub id: i32,
    pub name: String,
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

impl<S> OptionalFromRequestParts<S> for AuthUser
where
    S: Send + Sync,
{
    type Rejection = HttpError;

    async fn from_request_parts(parts: &mut Parts, _: &S) -> Result<Option<Self>, Self::Rejection> {
        Ok(parts.extensions.remove::<Self>())
    }
}

pub async fn from_token(
    State(state): State<AppState>,
    mut req: Request,
    next: Next,
) -> Result<Response, HttpError> {
    let Some(token) = parse_token(&req)? else {
        return Err(TOKEN_NOT_FOUND_ERROR);
    };

    let auth_user = fetch_user(&mut state.pool.get().await?, token.id).await?;

    req.extensions_mut().insert(auth_user);

    Ok(next.run(req).await)
}

pub async fn try_from_token(
    State(state): State<AppState>,
    mut req: Request,
    next: Next,
) -> Result<Response, HttpError> {
    let Some(token) = parse_token(&req)? else {
        return Ok(next.run(req).await);
    };

    let auth_user = fetch_user(&mut state.pool.get().await?, token.id).await?;

    req.extensions_mut().insert(auth_user);

    Ok(next.run(req).await)
}

pub async fn try_from_cookie(
    State(state): State<AppState>,
    mut req: Request,
    next: Next,
) -> Result<Response, HttpError> {
    let Some(token) = parse_token_from_cookie(&req)? else {
        return Ok(next.run(req).await);
    };

    let auth_user = fetch_user(&mut state.pool.get().await?, token.id).await?;

    req.extensions_mut().insert(auth_user);

    Ok(next.run(req).await)
}

async fn fetch_user(
    conn: &mut PooledConnection<'_, AsyncPgConnection>,
    user_id: i32,
) -> Result<AuthUser, HttpError> {
    let Some(user) = users::table
        .select((users::id, users::name, users::state))
        .filter(users::id.eq(user_id))
        .first::<(i32, String, UserState)>(conn)
        .await
        .optional()?
    else {
        return Err(HttpError {
            code: StatusCode::UNAUTHORIZED,
            error: "failed_authorization",
            context: Some("User not found in the database".to_string()),
        });
    };

    if UserState::Enabled != user.2 {
        return Err(HttpError {
            code: StatusCode::FORBIDDEN,
            error: "failed_authorization",
            context: Some("User is not enabled".to_string()),
        });
    }

    Ok(AuthUser {
        id: user.0,
        name: user.1,
    })
}

fn parse_token(req: &Request) -> Result<Option<Token>, HttpError> {
    let token = if let Some(auth_header) = req.headers().get(http::header::AUTHORIZATION) {
        let Ok(auth_header) = auth_header.to_str() else {
            return Ok(None);
        };

        let Some(token) = auth_header.split_once("Bearer ").map(|split| split.1) else {
            return Ok(None);
        };

        token
    } else {
        let Some(query_string) = req.uri().query() else {
            return Ok(None);
        };

        // find the beginning of token
        let Some(token) = query_string.split_once("token=").map(|split| split.1) else {
            return Ok(None);
        };

        // then find the end of the token, token can be at the end of or in the middle of query string
        token.split_once("&").map(|t| t.0).unwrap_or(token)
    };

    let crypto = req.extensions().get::<Crypto>().unwrap();

    crypto
        .decode::<Token>(token)
        .map(|token| Some(token))
        .map_err(Into::into)
}

fn parse_token_from_cookie(req: &Request) -> Result<Option<Token>, HttpError> {
    let Some(cookie) = req.headers().get(http::header::COOKIE) else {
        return Ok(None);
    };

    let Ok(cookie) = cookie.to_str() else {
        return Ok(None);
    };

    let Some(token) = cookie.split_once("yelken_token=").map(|split| split.1) else {
        return Ok(None);
    };

    let token = token.split_once(";").map(|split| split.0).unwrap_or(token);

    let crypto = req.extensions().get::<Crypto>().unwrap();

    crypto
        .decode::<Token>(token)
        .map(|token| Some(token))
        .map_err(Into::into)
}
