use axum::{Router, middleware, routing::get};
use base::{AppState, middlewares::auth::from_token};

mod handlers;
mod responses;

pub fn router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/locales", get(handlers::fetch_locales))
        .route("/namespaces", get(handlers::fetch_namespaces))
        .route("/options", get(handlers::fetch_options))
        .layer(middleware::from_fn_with_state(state, from_token))
}
