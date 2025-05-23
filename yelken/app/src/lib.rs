use std::{convert::Infallible, pin::Pin, task::Poll};

use axum::{
    Extension, Router,
    body::Body,
    extract::Request,
    http::{HeaderValue, Method, StatusCode, header},
    response::{IntoResponse, Response},
};
use base::AppState;
use include_dir::{Dir, include_dir};
use mime_guess::mime;
use serde::Serialize;
use tower::Service;

static YK_APP: Dir = include_dir!("../app/dist/");

#[derive(Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
struct YelkenConfig {
    api_url: String,
    base_url: String,
}

#[derive(Clone)]
struct Index(String);

#[derive(Clone)]
struct ServeStaticDir;

impl<ReqBody> Service<Request<ReqBody>> for ServeStaticDir {
    type Response = Response<Body>;
    type Error = Infallible;
    type Future =
        Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>> + Send + 'static>>;

    fn poll_ready(
        &mut self,
        _: &mut std::task::Context<'_>,
    ) -> std::task::Poll<Result<(), Self::Error>> {
        Poll::Ready(Ok(()))
    }

    fn call(&mut self, req: Request<ReqBody>) -> Self::Future {
        if req.method() != Method::GET && req.method() != Method::HEAD {
            return Box::pin(async move {
                Ok(Response::builder()
                    .status(StatusCode::METHOD_NOT_ALLOWED)
                    .body(Body::empty())
                    .unwrap())
            });
        }

        let path = format!("assets{}", req.uri().path());

        Box::pin(async move {
            let Some(file) = YK_APP.get_file(path) else {
                return Ok(Response::builder()
                    .status(StatusCode::NOT_FOUND)
                    .body(Body::empty())
                    .unwrap());
            };

            let mime = mime_guess::from_path(&file.path())
                .first_raw()
                .map(HeaderValue::from_static)
                .unwrap_or_else(|| {
                    HeaderValue::from_str(mime::APPLICATION_OCTET_STREAM.as_ref()).unwrap()
                });

            Ok(Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, mime)
                .body(Body::from(file.contents()))
                .unwrap())
        })
    }
}

async fn handle_req(Extension(index): Extension<Index>, req: Request) -> Response {
    if req.method() != Method::GET {
        return StatusCode::METHOD_NOT_ALLOWED.into_response();
    }

    let mut resp = Response::new(Body::new(index.0));

    resp.headers_mut().insert(
        header::CONTENT_TYPE,
        "text/html; charset=utf-8".parse().unwrap(),
    );

    resp
}

pub fn router(base_url: &str) -> Router<AppState> {
    let index = YK_APP
        .get_file("index.html")
        .unwrap()
        .contents_utf8()
        .unwrap();

    let index = index.replace(
        "{YELKEN_CONFIG_STRING}",
        &serde_json::to_string(&YelkenConfig {
            api_url: format!("{base_url}/api"),
            base_url: format!("{base_url}/yk/app/"),
        })
        .unwrap(),
    );

    let index = index.replace("/{YELKEN_BASE_URL}/", &format!("{base_url}/yk/app/"));

    Router::new()
        .nest_service("/assets", ServeStaticDir)
        .fallback(handle_req)
        .layer(Extension(Index(index)))
}
