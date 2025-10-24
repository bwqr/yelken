use std::{
    str::FromStr,
    sync::{Mutex, OnceLock},
};

use axum::{
    Router,
    body::Body,
    extract::Request,
    http::{HeaderName, HeaderValue},
    middleware::Next,
    response::Response,
};
use base::{
    crypto::Crypto,
    db::{Connection, SyncConnection},
};
use diesel_async::{
    RunQueryDsl,
    pooled_connection::{AsyncDieselConnectionManager, deadpool},
};
use futures::StreamExt;
use include_dir::{Dir, include_dir};
use opendal::Operator;
use tower::Service;
use wasm_bindgen::prelude::wasm_bindgen;

static APP: OnceLock<Mutex<Router<()>>> = OnceLock::new();

#[cfg(not(feature = "sqlite"))]
compile_error!("\"sqlite\" feature needs to be enabled");

mod console_logger;

static THEME: Dir = include_dir!("../themes/default/");
static APP_ASSETS: Dir = include_dir!("../app/dist/");

fn fill_storage(storage: &Operator, path: &str, dir: &'static Dir) {
    let mut dirs = vec![dir];

    while let Some(dir) = dirs.pop() {
        for entry in dir.entries() {
            if let Some(dir) = entry.as_dir() {
                dirs.push(dir);
            } else if let Some(file) = entry.as_file() {
                let path = format!("{path}/{}", file.path().as_os_str().to_str().unwrap());

                storage.blocking().write(&path, file.contents()).unwrap();
            }
        }
    }
}

async fn logger(req: Request, next: Next) -> Response {
    let path = req.uri().path().to_owned();

    let res = next.run(req).await;

    ::log::info!("{:?} - {}", path, res.status(),);

    res
}

#[wasm_bindgen]
pub async fn app_init(base_url: String, name: String, email: String, password: String) {
    console_logger::init();

    console_error_panic_hook::set_once();

    let crypto = Crypto::new("super_secret_key");

    let storage = Operator::new(opendal::services::Memory::default())
        .unwrap()
        .finish();

    let app_assets_storage = Operator::new(opendal::services::Memory::default())
        .unwrap()
        .finish();

    let tmp_storage = Operator::new(opendal::services::Memory::default())
        .unwrap()
        .finish();

    let theme_storage = Operator::new(opendal::services::Memory::default())
        .unwrap()
        .finish();

    fill_storage(&theme_storage, "", &THEME);

    fill_storage(&app_assets_storage, "", &APP_ASSETS);

    let db_url = "/file.db";

    setup::migrate(&mut <SyncConnection as diesel::Connection>::establish(db_url).unwrap())
        .unwrap();

    let db_config = AsyncDieselConnectionManager::<Connection>::new(db_url);
    let pool = deadpool::Pool::builder(db_config).build().unwrap();

    let mut conn = pool.get().await.unwrap();

    diesel::sql_query("PRAGMA foreign_keys = ON;")
        .execute(&mut pool.get().await.unwrap())
        .await
        .unwrap();

    let create_admin = !setup::check_admin_initialized(&mut conn).await.unwrap();

    let admin_user = create_admin.then(|| setup::User {
        name,
        email,
        password,
    });

    let create_defaults = !setup::check_defaults_initialized(&mut conn).await.unwrap();

    let install_theme = !setup::check_theme_installed(&mut conn).await.unwrap();

    let install_theme = if install_theme {
        Some(setup::InstallTheme {
            src: theme_storage,
            src_dir: "".to_string(),
            dst: storage.clone(),
        })
    } else {
        None
    };

    setup::init(
        &mut conn,
        &crypto,
        create_defaults,
        admin_user,
        install_theme,
    )
    .await
    .unwrap();

    let site_url = base_url.parse().expect("Given base_url is not a valid url");
    let app_url = base_url.parse().expect("Given base_url is not a valid url");

    let config = base::config::Config {
        env: "dev".to_string(),
        site_url,
        app_url,
        reload_templates: true,
        upload_size_limit: 8192 * 1024,
    };

    let cors_origins = vec![];

    let app = yelken::router(
        crypto,
        config,
        pool,
        storage,
        app_assets_storage,
        tmp_storage,
        cors_origins,
    )
    .await
    .layer(axum::middleware::from_fn(logger));

    APP.set(Mutex::new(app)).unwrap();
}

#[wasm_bindgen]
pub async fn serve_request(
    method: String,
    uri: String,
    header_keys: Vec<String>,
    header_values: Vec<String>,
    body: Vec<u8>,
) -> web_sys::Response {
    let mut request: Request<Body> = Request::builder()
        .uri(uri)
        .method(method.as_str())
        .body(Body::from(body))
        .unwrap();
    header_keys
        .into_iter()
        .zip(header_values.into_iter())
        .for_each(|(key, value)| {
            request.headers_mut().append(
                HeaderName::from_str(key.as_str()).unwrap(),
                HeaderValue::from_str(value.as_str()).unwrap(),
            );
        });

    let resp = APP
        .get()
        .unwrap()
        .lock()
        .unwrap()
        .call(request)
        .await
        .unwrap();

    let headers = web_sys::Headers::new().unwrap();
    resp.headers().iter().for_each(|(key, value)| {
        headers
            .append(key.as_str(), value.to_str().unwrap())
            .unwrap()
    });
    let resp_init = web_sys::ResponseInit::new();
    resp_init.set_headers(&headers.into());
    resp_init.set_status(resp.status().as_u16());
    resp_init.set_status_text(resp.status().as_str());

    let mut body = resp.into_body().into_data_stream();
    let mut bytes: Vec<u8> = vec![];

    while let Some(Ok(b)) = body.next().await {
        bytes.extend_from_slice(&b);
    }

    web_sys::Response::new_with_opt_u8_array_and_init(Some(bytes.as_mut_slice()), &resp_init)
        .unwrap()
}
