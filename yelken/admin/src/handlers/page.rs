use axum::{
    extract::{Path, Query, State},
    Json,
};
use base::{
    models::Page,
    responses::HttpError,
    schema::{pages, themes},
    AppState,
};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;

use crate::requests::{CreatePage, FilterLocale, FilterNamespace, UpdatePage};

pub async fn fetch_pages(
    State(state): State<AppState>,
    Query(req): Query<FilterNamespace>,
) -> Result<Json<Vec<Page>>, HttpError> {
    if let Some(namespace) = req.namespace {
        pages::table
            .filter(pages::namespace.eq(namespace.0))
            .load::<Page>(&mut state.pool.get().await?)
    } else {
        pages::table
            .filter(pages::namespace.is_null())
            .load::<Page>(&mut state.pool.get().await?)
    }
    .await
    .map(Json)
    .map_err(Into::into)
}

pub async fn fetch_page(
    State(state): State<AppState>,
    Path(page_key): Path<String>,
    Query(req): Query<FilterNamespace>,
) -> Result<Json<Vec<Page>>, HttpError> {
    let query = pages::table.filter(pages::key.eq(page_key));

    if let Some(namespace) = req.namespace {
        query
            .filter(pages::namespace.eq(namespace.0))
            .load::<Page>(&mut state.pool.get().await?)
    } else {
        query
            .filter(pages::namespace.is_null())
            .load::<Page>(&mut state.pool.get().await?)
    }
    .await
    .map(Json)
    .map_err(Into::into)
}

pub async fn create_page(
    State(state): State<AppState>,
    Json(req): Json<CreatePage>,
) -> Result<Json<Page>, HttpError> {
    use diesel::dsl::{exists, select};

    let mut conn = state.pool.get().await?;

    let exists_query = pages::table.into_boxed();

    let exists_query = if let Some(namespace) = &req.namespace {
        let exists = diesel::dsl::select(diesel::dsl::exists(
            themes::table.filter(themes::id.eq(&namespace)),
        ))
        .get_result::<bool>(&mut state.pool.get().await?)
        .await?;

        if !exists {
            return Err(HttpError::conflict("namespace_not_found"));
        }

        exists_query.filter(pages::namespace.eq(namespace))
    } else {
        exists_query.filter(pages::namespace.is_null())
    };

    let exists_query = if let Some(locale) = &req.locale {
        exists_query.filter(
            pages::path
                .eq(&req.path)
                .and(pages::locale.eq(locale))
                .or(pages::key.eq(&req.key).and(pages::locale.eq(locale))),
        )
    } else {
        exists_query.filter(
            pages::path
                .eq(&req.path)
                .and(pages::locale.is_null())
                .or(pages::key.eq(&req.key).and(pages::locale.is_null())),
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
            pages::namespace.eq(req.namespace),
            pages::key.eq(req.key),
            pages::name.eq(req.name),
            pages::desc.eq(req.desc),
            pages::path.eq(req.path),
            pages::template.eq(req.template),
            pages::locale.eq(req.locale),
        ))
        .get_result::<Page>(&mut conn)
        .await
        .map(Json)
        .map_err(Into::into)
}

pub async fn update_page(
    State(state): State<AppState>,
    Path(page_key): Path<String>,
    Query(namespace): Query<FilterNamespace>,
    Json(req): Json<UpdatePage>,
) -> Result<(), HttpError> {
    let query = diesel::update(pages::table)
        .set((pages::name.eq(req.name), pages::desc.eq(req.desc)))
        .filter(pages::key.eq(page_key));

    let effected_row: usize = if let Some(namespace) = namespace.namespace {
        query
            .filter(pages::namespace.eq(namespace.0))
            .execute(&mut state.pool.get().await?)
    } else {
        query
            .filter(pages::namespace.is_null())
            .execute(&mut state.pool.get().await?)
    }
    .await?;

    if effected_row == 0 {
        return Err(HttpError::not_found("page_not_found"));
    }

    Ok(())
}

pub async fn delete_page(
    State(state): State<AppState>,
    Path(page_key): Path<String>,
    Query(namespace): Query<FilterNamespace>,
    Query(locale): Query<FilterLocale>,
) -> Result<(), HttpError> {
    let mut query = diesel::delete(pages::table)
        .filter(pages::key.eq(page_key))
        .into_boxed();

    if let Some(namespace) = namespace.namespace {
        query = query.filter(pages::namespace.eq(namespace.0))
    } else {
        query = query.filter(pages::namespace.is_null())
    };

    if let Some(locale) = locale.locale {
        query = query.filter(pages::locale.eq(locale))
    } else {
        query = query.filter(pages::locale.is_null())
    };

    let effected_row: usize = query.execute(&mut state.pool.get().await?).await?;

    if effected_row == 0 {
        return Err(HttpError::not_found("page_not_found"));
    }

    Ok(())
}
