use axum::{extract::State, Extension, Json};
use base::{responses::HttpError, schema::plugins, AppState};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;

use crate::{host::Menu, PluginHost};

#[derive(Clone, Deserialize, Serialize)]
pub struct Plugin {
    pub id: String,
    pub version: String,
    pub enabled: bool,
    pub name: String,
    pub desc: String,
    pub menus: Option<Arc<[Menu]>>,
}

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
