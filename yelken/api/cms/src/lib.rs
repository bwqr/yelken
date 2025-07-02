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
mod requests;
mod responses;

pub use handlers::{asset, content, model, tag};

pub fn router(state: AppState) -> Router<AppState> {
    let asset_read = Router::new()
        .route("/all", get(asset::fetch_assets))
        .route("/view/{id}", get(asset::fetch_asset))
        .layer(PermissionLayer {
            pool: state.pool.clone(),
            perm: Permission::CMSRead,
        });

    let asset_write = Router::new()
        .route(
            "/create",
            post(asset::create_asset).layer(DefaultBodyLimit::max(state.config.upload_size_limit)),
        )
        .route("/update/{id}", put(asset::update_asset))
        .route("/delete/{id}", delete(asset::delete_asset))
        .layer(PermissionLayer {
            pool: state.pool.clone(),
            perm: Permission::AssetWrite,
        });

    let content_read = Router::new()
        .route("/all", get(content::fetch_contents))
        .route("/view/{id}", get(content::fetch_content))
        .layer(PermissionLayer {
            pool: state.pool.clone(),
            perm: Permission::CMSRead,
        });

    let content_write = Router::new()
        .route("/create", post(content::create_content))
        .route("/update/{id}", put(content::update_content))
        .route("/stage/{id}", put(content::update_content_stage))
        .route("/delete/{id}", delete(content::delete_content))
        .route("/value/{id}/create", post(content::create_content_value))
        .route("/value/{id}/update", put(content::update_content_value))
        .route("/value/{id}/delete", delete(content::delete_content_value))
        .layer(PermissionLayer {
            pool: state.pool.clone(),
            perm: Permission::ContentWrite,
        });

    let field_read = Router::new()
        .route("/all", get(handlers::fetch_fields))
        .layer(PermissionLayer {
            pool: state.pool.clone(),
            perm: Permission::CMSRead,
        });

    let model_read = Router::new()
        .route("/all", get(model::fetch_models))
        .layer(PermissionLayer {
            pool: state.pool.clone(),
            perm: Permission::CMSRead,
        });

    let model_write = Router::new()
        .route("/create", post(model::create_model))
        .route("/update/{id}", put(model::update_model))
        .route("/delete/{id}", delete(model::delete_model))
        .route("/field/{id}/create", post(model::create_model_field))
        .route("/field/{id}/update", put(model::update_model_field))
        .route("/field/{id}/delete", delete(model::delete_model_field))
        .layer(PermissionLayer {
            pool: state.pool.clone(),
            perm: Permission::ModelWrite,
        });

    let tag_read = Router::new()
        .route("/all", get(tag::fetch_tags))
        .layer(PermissionLayer {
            pool: state.pool.clone(),
            perm: Permission::CMSRead,
        });

    let tag_asset_write = Router::new()
        .route("/asset/create", post(tag::create_asset_tag))
        .layer(PermissionLayer {
            pool: state.pool.clone(),
            perm: Permission::AssetWrite,
        });

    let tag_content_write = Router::new()
        .route("/content/create", post(tag::create_content_tag))
        .layer(PermissionLayer {
            pool: state.pool.clone(),
            perm: Permission::ContentWrite,
        });

    Router::new()
        .nest("/asset", asset_read.merge(asset_write))
        .nest("/content", content_read.merge(content_write))
        .nest("/field", field_read)
        .nest("/model", model_read.merge(model_write))
        .nest(
            "/tag",
            tag_read.merge(tag_asset_write).merge(tag_content_write),
        )
        .layer(middleware::from_fn_with_state(state.clone(), from_token))
}
