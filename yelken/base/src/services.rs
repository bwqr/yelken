use std::{
    convert::Infallible,
    path::{Component, PathBuf},
    str::FromStr,
    task::Poll,
};

use axum::{
    body::Body,
    extract::Request,
    http::{header, HeaderValue, Method, StatusCode},
    response::Response,
};
use futures::{future::BoxFuture, FutureExt};
use mime_guess::mime;
use opendal::{ErrorKind, Operator};
use serde::Deserialize;
use tower::Service;

use crate::runtime::IntoSendFuture;

pub struct SafePath<const DEPTH: usize>(pub String);

impl<const DEPTH: usize> FromStr for SafePath<DEPTH> {
    type Err = &'static str;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let path = PathBuf::from(s);

        if path.components().count() > DEPTH {
            return Err("too_deep_path");
        }

        if path.components().any(|c| {
            if let Component::Normal(_) = c {
                false
            } else {
                true
            }
        }) {
            return Err("invalid_path");
        }

        Ok(SafePath(s.to_string()))
    }
}

impl<'de, const DEPTH: usize> Deserialize<'de> for SafePath<DEPTH> {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let string = String::deserialize(deserializer)?;

        let path = PathBuf::from(&string);

        if path.components().count() > DEPTH {
            return Err(serde::de::Error::custom("too_deep_path"));
        }

        if path.components().any(|c| {
            if let Component::Normal(_) = c {
                false
            } else {
                true
            }
        }) {
            return Err(serde::de::Error::custom("invalid_path"));
        }

        Ok(SafePath(string))
    }
}

#[derive(Clone)]
pub struct ServeStorageDir<F> {
    storage: Operator,
    path: F,
}

impl<F> ServeStorageDir<F>
where
    F: Fn() -> String + 'static,
{
    pub fn new(storage: Operator, path: F) -> Self {
        Self { storage, path }
    }
}

impl<F, ReqBody> Service<Request<ReqBody>> for ServeStorageDir<F>
where
    F: Fn() -> String + 'static,
{
    type Response = Response<Body>;
    type Error = Infallible;
    type Future = BoxFuture<'static, Result<Self::Response, Self::Error>>;

    fn poll_ready(
        &mut self,
        _: &mut std::task::Context<'_>,
    ) -> std::task::Poll<Result<(), Self::Error>> {
        Poll::Ready(Ok(()))
    }

    fn call(&mut self, req: Request<ReqBody>) -> Self::Future {
        if req.method() != Method::GET && req.method() != Method::HEAD {
            return async move {
                Ok(Response::builder()
                    .status(StatusCode::METHOD_NOT_ALLOWED)
                    .body(Body::empty())
                    .unwrap())
            }
            .boxed();
        }

        let Ok(path) = SafePath::<5>::from_str(req.uri().path()) else {
            return async move {
                Ok(Response::builder()
                    .status(StatusCode::BAD_REQUEST)
                    .body(Body::empty())
                    .unwrap())
            }
            .boxed();
        };

        let path = format!("{}{}", (self.path)(), path.0);

        let storage = self.storage.clone();

        // TODO implement a more feature complete solution similar to ServeDir
        async move {
            match storage.read(&path).into_send_future().await {
                Ok(bytes) => {
                    let mime = mime_guess::from_path(&path)
                        .first_raw()
                        .map(HeaderValue::from_static)
                        .unwrap_or_else(|| {
                            HeaderValue::from_str(mime::APPLICATION_OCTET_STREAM.as_ref()).unwrap()
                        });

                    Ok(Response::builder()
                        .status(StatusCode::OK)
                        .header(header::CONTENT_TYPE, mime)
                        .body(Body::from_stream(bytes))
                        .unwrap())
                }
                Err(e) => {
                    if e.kind() == ErrorKind::NotFound || e.kind() == ErrorKind::PermissionDenied {
                        return Ok(Response::builder()
                            .status(StatusCode::NOT_FOUND)
                            .body(Body::empty())
                            .unwrap());
                    }

                    log::warn!("Failed to read file from storage {path}");

                    return Ok(Response::builder()
                        .status(StatusCode::INTERNAL_SERVER_ERROR)
                        .body(Body::empty())
                        .unwrap());
                }
            }
        }
        .boxed()
    }
}
