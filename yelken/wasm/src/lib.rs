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
    models::User,
    schema::{permissions, users},
};
use diesel_async::pooled_connection::{AsyncDieselConnectionManager, deadpool};
use futures::StreamExt;
use opendal::Operator;
use tower::Service;
use wasm_bindgen::prelude::wasm_bindgen;

static APP: OnceLock<Mutex<Router<()>>> = OnceLock::new();

#[cfg(not(feature = "sqlite"))]
compile_error!("\"sqlite\" feature needs to be enabled");

mod console_logger;

fn load_theme(storage: &Operator) {
    use include_dir::{Dir, include_dir};

    static THEME: Dir = include_dir!("../themes/default/");

    let mut dirs = vec![&THEME];

    while let Some(dir) = dirs.pop() {
        for entry in dir.entries() {
            if let Some(dir) = entry.as_dir() {
                dirs.push(dir);
            } else if let Some(file) = entry.as_file() {
                let path = format!(
                    "themes/default/{}",
                    file.path().as_os_str().to_str().unwrap()
                );

                storage.blocking().write(&path, file.contents()).unwrap();
            }
        }
    }
}

fn create_user(
    mut conn: SyncConnection,
    crypto: &Crypto,
    name: String,
    email: String,
    password: String,
) {
    use diesel::prelude::*;
    use rand::{Rng, distr::Alphanumeric, rng};

    let salt: String = (0..32)
        .map(|_| rng().sample(Alphanumeric) as char)
        .collect();

    let password = crypto.sign512((password + salt.as_str()).as_bytes());

    let user = diesel::insert_into(users::table)
        .values((
            users::username.eq("yelken_test_user"),
            users::name.eq(name),
            users::email.eq(email),
            users::password.eq(salt + password.as_str()),
        ))
        .get_result::<User>(&mut conn)
        .unwrap();

    let perms = ["admin", "user.read", "content.read", "content.write"];

    for perm in perms {
        diesel::insert_into(permissions::table)
            .values((permissions::user_id.eq(user.id), permissions::name.eq(perm)))
            .execute(&mut conn)
            .unwrap();
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

    let tmp_storage = Operator::new(opendal::services::Memory::default())
        .unwrap()
        .finish();

    let db_url = "/file.db";

    {
        let mut conn = <SyncConnection as diesel::Connection>::establish(db_url).unwrap();

        setup::migrate(&mut conn).unwrap();

        create_user(conn, &crypto, name, email, password);

        load_theme(&storage);
    }

    let db_config = AsyncDieselConnectionManager::<Connection>::new(db_url);
    let pool = deadpool::Pool::builder(db_config).build().unwrap();

    let config = base::config::Config {
        env: "dev".to_string(),
        backend_url: base_url.clone(),
        frontend_url: base_url,
        reload_templates: true,
    };

    let app = yelken::router(crypto, config, pool, storage, tmp_storage)
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
