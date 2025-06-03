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
use handlers::{install, locale, options, page, permission, role, template, theme, user};

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
        .route("/page/pages", get(page::fetch_pages))
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
        .route("/template/templates", get(template::fetch_templates))
        .route("/template/template", get(template::fetch_template))
        .route("/template", put(template::update_template))
        .route("/template", delete(template::delete_template))
        .route("/theme/themes", get(theme::fetch_themes))
        .route("/theme/theme", post(install::install_theme))
        .route("/theme/theme/{theme}", delete(install::uninstall_theme))
        .route("/options/theme", put(options::update_theme))
        .route(
            "/options/default-locale",
            put(options::update_default_locale),
        )
        .layer(PermissionLayer {
            pool: state.pool.clone(),
            perm: Permission::Admin,
        })
        .layer(middleware::from_fn_with_state(state, from_token))
}
