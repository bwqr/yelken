use axum::{extract::State, Json};
use base::{models::HttpError, schema::plugins, AppState};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use shared::plugin::Plugin;

pub async fn fetch_plugins(State(state): State<AppState>) -> Result<Json<Vec<Plugin>>, HttpError> {
    let mut conn = state.pool.get().await?;

    let plugins = plugins::table
        .select((plugins::id, plugins::name))
        .load(&mut conn)
        .await?
        .into_iter()
        .map(|(id, name)| Plugin { id, name })
        .collect();

    Ok(Json(plugins))
}
