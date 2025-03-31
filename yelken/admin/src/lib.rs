use axum::{
    middleware,
    routing::{delete, post, put},
    Router,
};
use base::{
    middlewares::{auth::from_token, permission::PermissionLayer},
    AppState,
};
use handlers::{locale, permission, role, user};
use shared::permission::Permission;

mod handlers;
mod requests;
mod responses;

pub fn router(state: AppState) -> Router<AppState> {
    Router::new()
        .route(
            "/permission/role/{role_id}",
            post(permission::update_role_permissions),
        )
        .route(
            "/permission/user/{user_id}",
            post(permission::update_user_permissions),
        )
        .route("/user", post(user::create_user))
        .route("/user/{user_id}/state", put(user::update_user_state))
        .route("/user/{user_id}/role", put(user::update_user_role))
        .route("/role", post(role::create_role))
        .route("/role/{role_id}", delete(role::delete_role))
        .route("/locale", post(locale::create_locale))
        .route(
            "/locale/{locale_key}/state",
            put(locale::update_locale_state),
        )
        .route("/locale/{locale_key}", delete(locale::delete_locale))
        .layer(PermissionLayer {
            pool: state.pool.clone(),
            perm: Permission::Admin,
        })
        .layer(middleware::from_fn_with_state(state, from_token))
}
