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
use serde::{Deserialize, Serialize};
use tower::Service;

use crate::runtime::IntoSendFuture;

#[derive(Clone)]
pub struct SafePath<const DEPTH: usize>(String);

impl<const DEPTH: usize> SafePath<DEPTH> {
    pub fn inner(&self) -> &str {
        &self.0
    }

    pub fn into_inner(self) -> String {
        self.0
    }
}

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

impl<const DEPTH: usize> Serialize for SafePath<DEPTH> {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        <String as Serialize>::serialize(&self.0, serializer)
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
            return async move { Ok(response_from_status(StatusCode::METHOD_NOT_ALLOWED)) }.boxed();
        }

        let mut path = req.uri().path();

        if let Some(p) = path.strip_prefix("/") {
            path = p;
        }

        let Ok(path) = SafePath::<7>::from_str(path)
            .inspect_err(|e| log::debug!("Could not construct SafePath from {path} path, {e:?}"))
        else {
            return async move { Ok(response_from_status(StatusCode::NOT_FOUND)) }.boxed();
        };

        let path = format!("{}/{}", (self.path)(), path.inner());

        let storage = self.storage.clone();

        let if_modified_since = req
            .headers()
            .get(header::IF_MODIFIED_SINCE)
            .and_then(|lm| lm.to_str().ok())
            .and_then(|lm| chrono::DateTime::parse_from_rfc2822(lm).ok());

        let if_unmodified_since = req
            .headers()
            .get(header::IF_UNMODIFIED_SINCE)
            .and_then(|lm| lm.to_str().ok())
            .and_then(|lm| chrono::DateTime::parse_from_rfc2822(lm).ok());

        let method = req.method().clone();

        async move {
            let meta = match storage.stat(&path).into_send_future().await {
                Ok(meta) => meta,
                Err(e) => return Ok(response_from_opendal_error(e)),
            };

            let mut response = Response::builder();

            if let Some(last_modified) = meta.last_modified() {
                if if_modified_since
                    .map(|since| since.timestamp() >= last_modified.timestamp())
                    .unwrap_or(false)
                    || if_unmodified_since
                        .map(|since| since.timestamp() <= last_modified.timestamp())
                        .unwrap_or(false)
                {
                    return Ok(response_from_status(StatusCode::NOT_MODIFIED));
                }

                response = response.header(header::LAST_MODIFIED, last_modified.to_rfc2822());
            }

            let mime = mime_guess::from_path(&path)
                .first_raw()
                .map(HeaderValue::from_static)
                .unwrap_or_else(|| {
                    HeaderValue::from_str(mime::APPLICATION_OCTET_STREAM.as_ref()).unwrap()
                });

            response = response
                .header(header::CONTENT_TYPE, mime)
                .header(header::CONTENT_LENGTH, meta.content_length().to_string());

            if method == Method::HEAD {
                return Ok(response.status(StatusCode::OK).body(Body::empty()).unwrap());
            }

            let reader = match storage.reader(&path).into_send_future().await {
                Ok(reader) => reader,
                Err(e) => return Ok(response_from_opendal_error(e)),
            };

            // TODO implement support for ACCEPT_RANGES and RANGE header similar to tower-http's fs service.
            let stream = match reader.into_bytes_stream(..).into_send_future().await {
                Ok(stream) => {
                    #[cfg(target_family = "wasm")]
                    {
                        send_wrapper::SendWrapper::new(stream)
                    }

                    #[cfg(not(target_family = "wasm"))]
                    {
                        stream
                    }
                }
                Err(e) => return Ok(response_from_opendal_error(e)),
            };

            Ok(response
                .status(StatusCode::OK)
                .body(Body::from_stream(stream))
                .unwrap())
        }
        .boxed()
    }
}

fn response_from_opendal_error(e: opendal::Error) -> Response<Body> {
    if e.kind() == ErrorKind::NotFound || e.kind() == ErrorKind::PermissionDenied {
        return response_from_status(StatusCode::NOT_FOUND);
    }

    response_from_status(StatusCode::INTERNAL_SERVER_ERROR)
}

fn response_from_status(status: StatusCode) -> Response<Body> {
    Response::builder()
        .status(status)
        .body(Body::empty())
        .unwrap()
}
