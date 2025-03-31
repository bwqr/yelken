use axum::{extract::State, Extension, Json};
use base::{responses::HttpError, schema::plugins, AppState};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use shared::plugin::Plugin;

use crate::PluginHost;

pub async fn fetch_plugins(
    State(state): State<AppState>,
    Extension(plugin_host): Extension<PluginHost>,
) -> Result<Json<Vec<Plugin>>, HttpError> {
    let mut conn = state.pool.get().await?;

    let plugins = plugins::table
        .select((
            plugins::id,
            plugins::version,
            plugins::enabled,
            plugins::name,
            plugins::desc,
        ))
        .load::<(String, String, bool, String, String)>(&mut conn)
        .await?
        .into_iter()
        .map(|(id, version, enabled, name, desc)| {
            let menus = plugin_host.plugin_menus(id.as_str());

            Plugin {
                id,
                version,
                enabled,
                name,
                desc,
                menus,
            }
        })
        .collect();

    Ok(Json(plugins))
}
