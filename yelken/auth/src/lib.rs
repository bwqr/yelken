use axum::{routing::post, Router};
use base::AppState;

mod handlers;
mod requests;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/login", post(handlers::login))
        .route("/sign-up", post(handlers::sign_up))
}
