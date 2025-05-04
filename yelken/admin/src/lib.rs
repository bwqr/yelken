use std::{
    path::{Component, PathBuf},
    str::FromStr,
};

use axum::{
    middleware,
    routing::{delete, post, put},
    Router,
};
use base::{
    middlewares::{
        auth::from_token,
        permission::{Permission, PermissionLayer},
    },
    AppState,
};
use handlers::{install, locale, options, permission, role, template, user};
use serde::Deserialize;

mod handlers;
mod requests;
mod responses;

pub(crate) struct SafePath<const DEPTH: usize>(pub PathBuf);

impl<const DEPTH: usize> FromStr for SafePath<DEPTH> {
    type Err = &'static str;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let path = PathBuf::from(s);

        if path.components().count() > DEPTH {
            return Err("too_deep_path");
        }

        if path.components().any(|c| {
            if let Component::Normal(_) = c {
                false
            } else {
                true
            }
        }) {
            return Err("invalid_path");
        }

        Ok(SafePath(path))
    }
}

impl<'de, const DEPTH: usize> Deserialize<'de> for SafePath<DEPTH> {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let string = String::deserialize(deserializer)?;

        let path = PathBuf::from(string);

        if path.components().count() > DEPTH {
            return Err(serde::de::Error::custom("too_deep_path"));
        }

        if path.components().any(|c| {
            if let Component::Normal(_) = c {
                false
            } else {
                true
            }
        }) {
            return Err(serde::de::Error::custom("invalid_path"));
        }

        Ok(SafePath(path))
    }
}

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
        .route(
            "/locale/{locale_key}/resource",
            put(locale::update_locale_resource),
        )
        .route(
            "/locale/{locale_key}/resource",
            delete(locale::delete_locale_resource),
        )
        .route("/locale/{locale_key}", delete(locale::delete_locale))
        .route("/template", put(template::update_template))
        .route("/template", delete(template::delete_template))
        .route("/install/theme", post(install::install_theme))
        .route("/uninstall/theme/{theme}", delete(install::uninstall_theme))
        .route("/options/theme", post(options::update_theme))
        .route(
            "/options/default-locale",
            post(options::update_default_locale),
        )
        .layer(PermissionLayer {
            pool: state.pool.clone(),
            perm: Permission::Admin,
        })
        .layer(middleware::from_fn_with_state(state, from_token))
}
