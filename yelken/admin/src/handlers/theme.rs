use axum::{extract::State, Json};
use base::{models::Theme, responses::HttpError, schema::themes, AppState};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;

pub async fn fetch_themes(State(state): State<AppState>) -> Result<Json<Vec<Theme>>, HttpError> {
    themes::table
        .order(themes::created_at.asc())
        .load::<Theme>(&mut state.pool.get().await?)
        .await
        .map(Json)
        .map_err(Into::into)
}
