use std::{convert::Infallible, sync::Arc, task::Poll};

use axum::{
    body::Body,
    extract::Request,
    http::{header, HeaderValue, Method, StatusCode},
    response::Response,
};
use futures::{future::BoxFuture, FutureExt};
use mime_guess::mime;
use opendal::{ErrorKind, Operator};
use tower::Service;

use crate::runtime::IntoSendFuture;

#[derive(Clone)]
pub struct ServeStorageDir {
    storage: Operator,
    path: Arc<str>,
}

impl ServeStorageDir {
    pub fn new(storage: Operator, path: Arc<str>) -> Self {
        Self { storage, path }
    }
}

impl<ReqBody> Service<Request<ReqBody>> for ServeStorageDir {
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

        let path = format!("{}{}", self.path, req.uri().path());

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
