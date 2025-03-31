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
mod requests;
mod responses;

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
        .route("/user", post(handlers::user::create_user))
        .route("/user/{user_id}/enable", put(handlers::user::enable_user))
        .route(
            "/user/{user_id}/disable",
            delete(handlers::user::disable_user),
        )
        .route(
            "/user/{user_id}/role",
            put(handlers::user::update_user_role),
        )
        .route("/role", post(handlers::role::create_role))
        .route("/role/{role_id}", delete(handlers::role::delete_role))
        .layer(PermissionLayer {
            pool: state.pool.clone(),
            perm: Permission::Admin,
        })
        .layer(middleware::from_fn_with_state(state, from_token))
}
