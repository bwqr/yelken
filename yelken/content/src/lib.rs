use axum::{middleware, routing::get, Router};
use base::AppState;

mod handlers;

pub use handlers::{fetch_fields, fetch_models};

pub fn router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/fields", get(handlers::fetch_fields))
        .route("/models", get(handlers::fetch_models))
        // .route("/model", post(handlers::create_model))
        .layer(middleware::from_fn_with_state(
            state,
            base::middlewares::auth,
        ))
}
