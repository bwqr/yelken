use axum::{middleware, routing::get, Router};
use base::{middlewares::auth::from_token, AppState};

mod handlers;
mod responses;

pub fn router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/profile", get(handlers::fetch_profile))
        .layer(middleware::from_fn_with_state(state, from_token))
}
