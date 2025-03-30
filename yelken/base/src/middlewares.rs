use std::{
    future::Future,
    pin::Pin,
    task::{Context, Poll},
};

use axum::{
    extract::{Request, State},
    http::{self, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};
use chrono::NaiveDateTime;
use diesel::prelude::*;
use diesel_async::{pooled_connection::bb8::PooledConnection, AsyncPgConnection, RunQueryDsl};
use shared::permission::Permission;
use tower::{Layer, Service};

use crate::{
    crypto::Crypto,
    models::{AuthUser, HttpError, Token},
    schema::{permissions, users},
    types::Pool,
    AppState,
};

const TOKEN_NOT_FOUND_ERROR: HttpError = HttpError {
    code: StatusCode::UNAUTHORIZED,
    error: "token_not_found",
    context: None,
};

#[derive(Clone)]
pub struct PermissionLayer {
    pub pool: Pool,
    pub perm: Permission,
}

impl<S> Layer<S> for PermissionLayer {
    type Service = PermissionService<S>;

    fn layer(&self, inner: S) -> Self::Service {
        PermissionService {
            inner,
            layer: self.clone(),
        }
    }
}

#[derive(Clone)]
pub struct PermissionService<S> {
    inner: S,
    layer: PermissionLayer,
}

impl<S> Service<Request> for PermissionService<S>
where
    S: Clone + Service<Request> + Send + 'static,
    S::Response: IntoResponse,
    S::Future: Send + 'static,
{
    type Response = Response;
    type Error = S::Error;
    type Future =
        Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>> + Send + 'static>>;

    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.inner.poll_ready(cx)
    }

    fn call(&mut self, req: Request) -> Self::Future {
        let layer = self.layer.clone();
        let user = req.extensions().get::<AuthUser>().cloned();
        let fut = self.inner.call(req);

        Box::pin(async move {
            let Some(user) = user else {
                return Ok(HttpError {
                    code: StatusCode::INTERNAL_SERVER_ERROR,
                    error: "auth_user_missing_from_request",
                    context: None,
                }
                .into_response());
            };

            {
                let mut conn = layer.pool.get().await.unwrap();

                let has_perm = diesel::dsl::select(diesel::dsl::exists(
                    permissions::table
                        .inner_join(
                            users::table.on(users::id
                                .nullable()
                                .eq(permissions::user_id)
                                .or(users::role_id.eq(permissions::role_id))),
                        )
                        .filter(
                            users::id
                                .eq(user.id)
                                .and(permissions::name.eq(*&layer.perm.as_str())),
                        ),
                ))
                .get_result::<bool>(&mut conn)
                .await
                .unwrap();

                if !has_perm {
                    return Ok(HttpError {
                        code: StatusCode::FORBIDDEN,
                        error: "access_denied",
                        context: None,
                    }
                    .into_response());
                }
            }

            fut.await.map(|resp| resp.into_response())
        })
    }
}

pub async fn auth(
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

pub async fn try_auth(
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

pub async fn try_auth_from_cookie(
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
    users::table
        .select((
            users::id,
            users::username,
            users::name,
            users::email,
            users::created_at,
        ))
        .filter(users::id.eq(user_id))
        .first::<(i32, String, String, String, NaiveDateTime)>(conn)
        .await
        .optional()?
        .map(|(id, username, name, email, created_at)| AuthUser {
            id,
            username,
            name,
            email,
            created_at,
        })
        .ok_or_else(|| HttpError {
            code: StatusCode::UNAUTHORIZED,
            error: "invalid_token",
            context: Some("User not found in the database".to_string()),
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
