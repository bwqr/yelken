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
    let permission_write = Router::new()
        .route(
            "/role/{role_id}/update",
            post(permission::update_role_permissions),
        )
        .route(
            "/user/{user_id}/update",
            post(permission::update_user_permissions),
        );

    let user_read = Router::new()
        .route("/all", get(user::fetch_users))
        .route("/view/{username}", get(user::fetch_user));

    let user_write = Router::new()
        .route("/create", post(user::create_user))
        .route("/update/{user_id}", put(user::update_user))
        .route("/delete/{user_id}", delete(user::delete_user));

    let role_read = Router::new()
        .route("/all", get(role::fetch_roles))
        .route("/view/{key}", get(role::fetch_role));

    let role_write = Router::new()
        .route("/create", post(role::create_role))
        .route("/update/{key}", put(role::update_role))
        .route("/delete/{key}", delete(role::delete_role));

    let locale_write = Router::new()
        .route("/create", post(locale::create_locale))
        .route("/update/{key}", put(locale::update_locale))
        .route("/state/{key}", put(locale::update_locale_state))
        .route("/resource/{key}", get(locale::fetch_locale_resource))
        .route(
            "/resource/{key}/update",
            put(locale::update_locale_resource),
        )
        .route(
            "/resource/{key}/delete",
            delete(locale::delete_locale_resource),
        )
        .route("/delete/{key}", delete(locale::delete_locale))
        .route("/default", put(locale::update_default_locale));

    Router::new()
        .nest("/permission", permission_write)
        .nest("/user", user_read.merge(user_write))
        .nest("/role", role_read.merge(role_write))
        .nest("/locale", locale_write)
        .layer(PermissionLayer {
            pool: state.pool.clone(),
            perm: Permission::Admin,
        })
        .layer(middleware::from_fn_with_state(state, from_token))
}
