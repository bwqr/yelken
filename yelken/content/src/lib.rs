use axum::{
    middleware,
    routing::{get, post, put},
    Router,
};
use base::{
    middlewares::permission::{Mode, Permission, PermissionLayer},
    AppState,
};

mod handlers;
mod requests;
mod responses;

pub use handlers::{fetch_fields, fetch_models};

pub fn router(state: AppState) -> Router<AppState> {
    let content_read = Router::new()
        .route("/contents", get(handlers::fetch_contents))
        .route("/fields", get(handlers::fetch_fields))
        .route("/locales", get(handlers::fetch_locales))
        .route("/models", get(handlers::fetch_models))
        .route("/content/{id}", get(handlers::fetch_content))
        .layer(PermissionLayer {
            pool: state.pool.clone(),
            perm: Permission::Content(Mode::Read),
        });

    let content_write = Router::new()
        .route("/model", post(handlers::create_model))
        .route("/content", post(handlers::create_content))
        .route("/content/{id}", post(handlers::create_content_value))
        .route("/content/{id}/stage", put(handlers::update_content_stage))
        .route("/value/{id}", put(handlers::update_content_value))
        .layer(PermissionLayer {
            pool: state.pool.clone(),
            perm: Permission::Content(Mode::Write),
        });

    Router::new()
        .merge(content_read)
        .merge(content_write)
        .layer(middleware::from_fn_with_state(
            state.clone(),
            base::middlewares::auth::from_token,
        ))
}
