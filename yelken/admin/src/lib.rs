use axum::{
    middleware,
    routing::{delete, post, put},
    Router,
};
use base::{
    middlewares::{auth::from_token, permission::PermissionLayer},
    AppState,
};
use shared::permission::Permission;

mod handlers;

pub fn router(state: AppState) -> Router<AppState> {
    Router::new()
        .route(
            "/permission/role/{role_id}",
            post(handlers::permission::update_role_permissions),
        )
        .route(
            "/permission/user/{user_id}",
            post(handlers::permission::update_user_permissions),
        )
        .layer(PermissionLayer {
            pool: state.pool.clone(),
            perm: Permission::Admin,
        })
        .layer(middleware::from_fn_with_state(state, from_token))
}
