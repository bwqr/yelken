use axum::{
    middleware,
    routing::{delete, get, post, put},
    Router,
};
use base::{
    middlewares::{
        auth::from_token,
        permission::{Permission, PermissionLayer},
    },
    AppState,
};
use handlers::{locale, permission, role, user};

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
        .route("/user/users", get(user::fetch_users))
        .route("/user/user/{username}", get(user::fetch_user))
        .route("/user", post(user::create_user))
        .route("/user/{user_id}", put(user::update_user))
        .route("/user/{user_id}", delete(user::delete_user))
        .route("/role", post(role::create_role))
        .route("/role/roles", get(role::fetch_roles))
        .route("/role/role/{key}", get(role::fetch_role))
        .route("/role/role/{key}", put(role::update_role))
        .route("/role/role/{key}", delete(role::delete_role))
        .route("/locale", post(locale::create_locale))
        .route("/locale/{locale_key}", put(locale::update_locale))
        .route(
            "/locale/{locale_key}/state",
            put(locale::update_locale_state),
        )
        .route(
            "/locale/{locale_key}/resource",
            get(locale::fetch_locale_resource),
        )
        .route(
            "/locale/{locale_key}/resource",
            put(locale::update_locale_resource),
        )
        .route(
            "/locale/{locale_key}/resource",
            delete(locale::delete_locale_resource),
        )
        .route("/locale/{locale_key}", delete(locale::delete_locale))
        .route("/locale/default", put(locale::update_default_locale))
        .layer(PermissionLayer {
            pool: state.pool.clone(),
            perm: Permission::Admin,
        })
        .layer(middleware::from_fn_with_state(state, from_token))
}
