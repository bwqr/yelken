use axum::{middleware, routing::get, Router};
use base::{
    middlewares::permission::{Mode, Permission, PermissionLayer},
    AppState,
};

mod handlers;
mod responses;

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
