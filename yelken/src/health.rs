use axum::{Router, routing::get};
use base::{AppState, responses::HttpError};

pub async fn health() -> Result<(), HttpError> {
    Ok(())
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/ready", get(health))
        .route("/live", get(health))
}
