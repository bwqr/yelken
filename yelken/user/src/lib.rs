use axum::{middleware, routing::get, Router};
use base::{middlewares::permission::PermissionLayer, AppState};
use shared::permission::{Mode, Permission};

mod handlers;

pub fn router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/profile", get(handlers::fetch_profile))
        .layer(PermissionLayer {
            pool: state.pool.clone(),
            perm: Permission::User(Mode::Read),
        })
        .layer(middleware::from_fn_with_state(
            state,
            base::middlewares::auth::from_token,
        ))
}
