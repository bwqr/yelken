use axum::{
    Extension, Router,
    body::Body,
    extract::Request,
    http::{Method, StatusCode, header},
    response::{IntoResponse, Response},
};
use base::{AppState, services::ServeStorageDir};
use opendal::Operator;
use serde::Serialize;
use url::Url;

#[derive(Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
struct YelkenConfig {
    site_url: String,
    base_url: String,
}

#[derive(Clone)]
struct Index(String);

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

pub fn router(app_assets_storage: Operator, site_url: Url) -> Router<AppState> {
    let index =
        std::io::read_to_string(app_assets_storage.blocking().read("index.html").unwrap()).unwrap();

    let mut base_url = site_url.clone();
    base_url
        .path_segments_mut()
        .unwrap()
        .pop_if_empty()
        .push("yk")
        .push("app")
        .push("");

    let mut site_url = site_url;
    site_url
        .path_segments_mut()
        .unwrap()
        .pop_if_empty();

    let index = index.replace(
        "{YELKEN_CONFIG_STRING}",
        &serde_json::to_string(&YelkenConfig {
            site_url: site_url.to_string(),
            base_url: base_url.path().to_string(),
        })
        .unwrap(),
    );

    let index = index.replace("/{YELKEN_BASE_URL}/", base_url.path());

    Router::new()
        .nest_service(
            "/static",
            ServeStorageDir::new(app_assets_storage, || "static".to_string()),
        )
        .fallback(handle_req)
        .layer(Extension(Index(index)))
}
