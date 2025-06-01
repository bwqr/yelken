use axum::{extract::State, Json};
use base::{models::Page, responses::HttpError, schema::pages, AppState};
use diesel_async::RunQueryDsl;

pub async fn fetch_pages(State(state): State<AppState>) -> Result<Json<Vec<Page>>, HttpError> {
    pages::table
        .load::<Page>(&mut state.pool.get().await?)
        .await
        .map(|pages| Json(pages))
        .map_err(Into::into)
}
