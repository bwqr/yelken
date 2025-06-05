use axum::{extract::State, Extension, Json};
use base::{config::Options, models::Page, responses::HttpError, schema::pages, AppState};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;

use crate::requests::CreatePage;

pub async fn fetch_pages(State(state): State<AppState>) -> Result<Json<Vec<Page>>, HttpError> {
    pages::table
        .load::<Page>(&mut state.pool.get().await?)
        .await
        .map(Json)
        .map_err(Into::into)
}

pub async fn create_page(
    State(state): State<AppState>,
    Extension(options): Extension<Options>,
    Json(req): Json<CreatePage>,
) -> Result<Json<Page>, HttpError> {
    use diesel::dsl::{exists, select};

    let mut conn = state.pool.get().await?;

    let theme = options.theme();

    let exists_query = pages::table.into_boxed();

    let exists_query = if req.theme_scoped {
        exists_query.filter(pages::namespace.eq(&*theme))
    } else {
        exists_query.filter(pages::namespace.is_null())
    };

    let exists_query = if let Some(locale) = &req.locale {
        exists_query.filter(
            pages::path
                .eq(&req.path)
                .and(pages::locale.eq(locale))
                .or(pages::name.eq(&req.name)),
        )
    } else {
        exists_query.filter(
            pages::path
                .eq(&req.path)
                .and(pages::locale.is_null())
                .or(pages::name.eq(&req.name)),
        )
    };

    if select(exists(exists_query))
        .get_result::<bool>(&mut conn)
        .await?
    {
        return Err(HttpError::conflict("page_already_exists"));
    }

    diesel::insert_into(pages::table)
        .values((
            pages::namespace.eq(req.theme_scoped.then_some(&*theme)),
            pages::name.eq(req.name),
            pages::path.eq(req.path),
            pages::template.eq(req.template),
            pages::locale.eq(req.locale),
        ))
        .get_result::<Page>(&mut conn)
        .await
        .map(Json)
        .map_err(Into::into)
}
