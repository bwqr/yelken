use axum::{
    extract::DefaultBodyLimit,
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

mod handlers;
mod l10n;
mod render;
mod requests;
mod responses;

pub use handlers::serve_page;
pub use l10n::L10n;
pub use render::Render;

use handlers::{page, template, theme};

pub fn router(state: AppState) -> Router<AppState> {
    let page_read = Router::new()
        .route("/all", get(page::fetch_pages))
        .route("/view/{key}", get(page::fetch_page))
        .layer(PermissionLayer {
            pool: state.pool.clone(),
            perm: Permission::AppearanceRead,
        });

    let page_write = Router::new()
        .route("/create", post(page::create_page))
        .route("/update/{key}", put(page::update_page))
        .route("/delete/{key}", delete(page::delete_page))
        .layer(PermissionLayer {
            pool: state.pool.clone(),
            perm: Permission::PageWrite,
        });

    let template_read = Router::new()
        .route("/all", get(template::fetch_templates))
        .route("/view", get(template::fetch_template))
        .layer(PermissionLayer {
            pool: state.pool.clone(),
            perm: Permission::AppearanceRead,
        });

    let template_write = Router::new()
        .route("/create", post(template::create_template))
        .route("/update", put(template::update_template))
        .route("/delete", delete(template::delete_template))
        .layer(PermissionLayer {
            pool: state.pool.clone(),
            perm: Permission::TemplateWrite,
        });

    let theme_read = Router::new()
        .route("/all", get(theme::fetch_themes))
        .layer(PermissionLayer {
            pool: state.pool.clone(),
            perm: Permission::AppearanceRead,
        });

    let theme_write = Router::new()
        .route("/activate", put(theme::activate_theme))
        .route(
            "/install",
            post(theme::install_theme).layer(DefaultBodyLimit::max(state.config.upload_size_limit)),
        )
        .route("/uninstall/{theme}", delete(theme::uninstall_theme))
        .layer(PermissionLayer {
            pool: state.pool.clone(),
            perm: Permission::ThemeWrite,
        });

    Router::new()
        .nest("/page", page_read.merge(page_write))
        .nest("/template", template_read.merge(template_write))
        .nest("/theme", theme_read.merge(theme_write))
        .layer(middleware::from_fn_with_state(state, from_token))
}
