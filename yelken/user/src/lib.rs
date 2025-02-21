use axum::{middleware, routing::get, Router};
use base::{middlewares::auth, AppState};

mod handlers;

pub fn router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/profile", get(handlers::fetch_profile))
        .layer(middleware::from_fn_with_state(state, auth))
}
