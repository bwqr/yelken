use axum::{middleware, routing::get, Router};
use base::{middlewares::permission::PermissionLayer, AppState};

mod handlers;

pub use handlers::{fetch_fields, fetch_models};
use shared::permission::{Mode, Permission};

pub fn router(state: AppState) -> Router<AppState> {
    let content_read = Router::new()
        .route("/fields", get(handlers::fetch_fields))
        .route("/models", get(handlers::fetch_models))
        .layer(PermissionLayer {
            pool: state.pool.clone(),
            perm: Permission::Content(Mode::Read),
        });

    let content_write = Router::new().layer(PermissionLayer {
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
