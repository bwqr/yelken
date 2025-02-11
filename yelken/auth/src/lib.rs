use axum::{routing::post, Router};
use base::AppState;

mod handlers;
mod requests;
mod responses;

pub fn router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/login", post(handlers::login))
        .route("/sign-up", post(handlers::sign_up))
        .with_state(state)
}
