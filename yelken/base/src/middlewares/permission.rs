use std::{
    future::Future,
    pin::Pin,
    task::{Context, Poll},
};

use axum::{
    extract::Request,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use serde::Serialize;
use tower::{Layer, Service};

use crate::{
    db::Pool,
    responses::HttpError,
    schema::{permissions, users},
};

use super::auth::AuthUser;

use std::str::FromStr;

pub const READ_ONLY_PERMS: [Permission; 2] = [Permission::CMSRead, Permission::AppearanceRead];
pub const FULL_PERMS: [Permission; 10] = [
    Permission::Admin,
    Permission::CMSRead,
    Permission::AssetWrite,
    Permission::ContentWrite,
    Permission::FormWrite,
    Permission::ModelWrite,
    Permission::AppearanceRead,
    Permission::PageWrite,
    Permission::TemplateWrite,
    Permission::ThemeWrite,
];

#[derive(Clone, Copy)]
pub enum Permission {
    Admin,
    CMSRead,
    AssetWrite,
    ContentWrite,
    FormWrite,
    ModelWrite,
    AppearanceRead,
    PageWrite,
    TemplateWrite,
    ThemeWrite,
}

impl Permission {
    pub fn as_str(&self) -> &'static str {
        match self {
            Permission::Admin => "admin",
            Permission::CMSRead => "cms.read",
            Permission::AssetWrite => "asset.write",
            Permission::ContentWrite => "content.write",
            Permission::FormWrite => "form.write",
            Permission::ModelWrite => "model.write",
            Permission::AppearanceRead => "appearance.read",
            Permission::PageWrite => "page.write",
            Permission::TemplateWrite => "template.write",
            Permission::ThemeWrite => "theme.write",
        }
    }
}

impl FromStr for Permission {
    type Err = &'static str;

    fn from_str(val: &str) -> Result<Self, Self::Err> {
        let perm = match val {
            "admin" => Permission::Admin,
            "cms.read" => Permission::CMSRead,
            "asset.write" => Permission::AssetWrite,
            "content.write" => Permission::ContentWrite,
            "form.write" => Permission::FormWrite,
            "model.write" => Permission::ModelWrite,
            "appearance.read" => Permission::AppearanceRead,
            "page.write" => Permission::PageWrite,
            "template.write" => Permission::TemplateWrite,
            "theme.write" => Permission::ThemeWrite,
            _ => return Err("unknown permission"),
        };

        Ok(perm)
    }
}

impl Serialize for Permission {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(self.as_str())
    }
}

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
                                .and(permissions::key.eq(*&layer.perm.as_str())),
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
