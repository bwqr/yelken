use axum::{
    extract::{Multipart, Path, Query, State},
    Json,
};
use base::{
    db::Pool,
    middlewares::auth::AuthUser,
    models::Asset,
    paginate::{CountStarOver, Paginate, Pagination, PaginationRequest},
    responses::HttpError,
    runtime::IntoSendFuture,
    schema::assets,
    AppState,
};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use futures::StreamExt;
use opendal::Operator;
use rand::{distr::Alphanumeric, rng, Rng};

pub async fn fetch_assets(
    State(state): State<AppState>,
    Query(page): Query<PaginationRequest>,
) -> Result<Json<Pagination<Asset>>, HttpError> {
    assets::table
        .select((assets::all_columns, CountStarOver))
        .paginate(page.page)
        .per_page(page.per_page)
        .load_and_count_pages::<Asset>(&mut state.pool.get().await?)
        .await
        .map(Json)
        .map_err(Into::into)
}

pub async fn fetch_asset(
    State(state): State<AppState>,
    Path(asset_id): Path<i32>,
) -> Result<Json<Asset>, HttpError> {
    assets::table
        .filter(assets::id.eq(asset_id))
        .first::<Asset>(&mut state.pool.get().await?)
        .await
        .map(Json)
        .map_err(Into::into)
}

pub async fn create_asset(
    State(state): State<AppState>,
    user: AuthUser,
    multipart: Multipart,
) -> Result<Json<Asset>, HttpError> {
    let tmp_dir = (0..32)
        .map(|_| rng().sample(Alphanumeric) as char)
        .collect::<String>();

    let result = store_and_insert_assert(
        multipart,
        &state.pool,
        &state.storage,
        &state.tmp_storage,
        &tmp_dir,
        user.id,
    )
    .await;

    if let Err(e) = state
        .tmp_storage
        .remove_all(&tmp_dir)
        .into_send_future()
        .await
    {
        log::warn!("Failed to remove tmp asset dir during cleanup, {tmp_dir}, {e:?}");
    }

    result.map(Json)
}

async fn store_and_insert_assert(
    mut multipart: Multipart,
    pool: &Pool,
    storage: &Operator,
    tmp_storage: &Operator,
    tmp_dir: &str,
    user_id: i32,
) -> Result<Asset, HttpError> {
    let mut file = None;

    while let Ok(Some(mut field)) = multipart.next_field().await {
        if file.is_some() {
            break;
        }

        match field
            .name()
            .ok_or(HttpError::bad_request("invalid_multipart"))?
        {
            "asset" => {
                let name = field.file_name().unwrap_or("empty-name").to_string();
                let filetype = field.content_type().map(|t| t.to_string());
                let path = format!("{tmp_dir}/asset");

                let mut sink = tmp_storage.writer(&path).into_send_future().await?;

                while let Some(chunk) = field
                    .chunk()
                    .await
                    .map_err(|_| HttpError::bad_request("invalid_multipart_field"))?
                {
                    sink.write(chunk).into_send_future().await?;
                }

                sink.close().into_send_future().await?;

                file = Some((path, name, filetype));
            }
            _ => continue,
        };
    }

    let Some((file, name, filetype)) = file else {
        return Err(HttpError::bad_request("missing_field_in_multipart"));
    };

    let filename = {
        let (filename, ext) = name.rsplit_once('.').unwrap_or((name.as_str(), ""));

        let mut filename = filename
            .chars()
            .filter(|ch| ch.is_ascii_alphanumeric())
            .take(96)
            .collect::<String>()
            + "_"
            + (0..12)
                .map(|_| rng().sample(Alphanumeric) as char)
                .collect::<String>()
                .as_str();

        if !ext.is_empty() {
            filename = filename + "." + ext;
        }

        filename
    };

    let asset = diesel::insert_into(assets::table)
        .values((
            assets::name.eq(name),
            assets::filename.eq(filename),
            assets::filetype.eq(filetype),
            assets::created_by.eq(user_id),
        ))
        .get_result::<Asset>(&mut pool.get().await?)
        .await?;

    let send_future = async move |filename: &str| {
        let mut writer = storage.writer(&format!("assets/{}", filename)).await?;

        let mut stream = tmp_storage.reader(&file).await?.into_stream(..).await?;

        while let Some(result) = stream.next().await {
            let chunk = result?;

            writer.write(chunk).await?;
        }

        writer.close().await?;

        Result::<(), HttpError>::Ok(())
    };

    send_future(&asset.filename).into_send_future().await?;

    Ok(asset)
}

pub async fn delete_asset(
    State(state): State<AppState>,
    Path(asset_id): Path<i32>,
) -> Result<(), HttpError> {
    let asset = assets::table
        .filter(assets::id.eq(asset_id))
        .first::<Asset>(&mut state.pool.get().await?)
        .await?;

    state
        .storage
        .delete(&format!("assets/{}", asset.filename))
        .into_send_future()
        .await?;

    diesel::delete(assets::table)
        .filter(assets::id.eq(asset_id))
        .execute(&mut state.pool.get().await?)
        .await?;

    Ok(())
}
