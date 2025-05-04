use axum::{
    Extension, Router,
    body::Body,
    extract::Request,
    http::{Method, StatusCode, header},
    response::{IntoResponse, Response},
};
use base::AppState;
use serde::Serialize;
use tower_http::services::ServeDir;

#[derive(Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
struct YelkenConfig {
    api_url: String,
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

pub fn router(backend_origin: &str, app_assets_dir: &str) -> Router<AppState> {
    let index = std::fs::read_to_string(format!("{}/index.html", app_assets_dir)).unwrap();

    let index = index.replace(
        "{YELKEN_CONFIG_STRING}",
        &serde_json::to_string(&YelkenConfig {
            api_url: format!("{backend_origin}/api"),
            base_url: "/yk/app/".to_string(),
        })
        .unwrap(),
    );

    let index = index.replace("/{YELKEN_BASE_URL}/", "/yk/app/");

    Router::new()
        .nest_service("/assets", ServeDir::new(format!("{app_assets_dir}/assets")))
        .fallback(handle_req)
        .layer(Extension(Index(index)))
}
