use axum::{
    middleware,
    routing::{delete, get, post, put},
    Router,
};
use base::{
    middlewares::permission::{Mode, Permission, PermissionLayer},
    AppState,
};

mod handlers;
mod requests;
mod responses;

pub use handlers::{asset, content, model};

pub fn router(state: AppState) -> Router<AppState> {
    let content_read = Router::new()
        .route("/contents", get(content::fetch_contents))
        .route("/fields", get(handlers::fetch_fields))
        .route("/locales", get(handlers::fetch_locales))
        .route("/models", get(model::fetch_models))
        .route("/options", get(handlers::fetch_options))
        .route("/assets", get(asset::fetch_assets))
        .route("/asset/{id}", get(asset::fetch_asset))
        .route("/content/{id}", get(content::fetch_content))
        .layer(PermissionLayer {
            pool: state.pool.clone(),
            perm: Permission::Content(Mode::Read),
        });

    let content_write = Router::new()
        .route("/model", post(model::create_model))
        .route("/assets", post(asset::create_asset))
        .route("/asset/{id}", delete(asset::delete_asset))
        .route("/content", post(content::create_content))
        .route("/content/{id}", post(content::create_content_value))
        .route("/content/{id}", delete(content::delete_content))
        .route("/content/{id}/stage", put(content::update_content_stage))
        .route("/value/{id}", put(content::update_content_value))
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
