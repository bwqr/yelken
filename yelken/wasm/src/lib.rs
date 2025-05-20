use std::{
    str::FromStr,
    sync::{Mutex, OnceLock},
};

use axum::{
    Router,
    body::Body,
    extract::Request,
    http::{HeaderName, HeaderValue},
};
use futures::StreamExt;
use tower::Service;
use wasm_bindgen::prelude::wasm_bindgen;

static APP: OnceLock<Mutex<Router<()>>> = OnceLock::new();

mod log {
    use log::Log;
    use wasm_bindgen::prelude::*;

    struct Logger;

    impl Logger {
        fn init(self) {
            log::set_logger(Box::leak(Box::new(self))).unwrap();
            log::set_max_level(log::LevelFilter::Debug);
        }
    }

    impl Log for Logger {
        fn enabled(&self, _: &log::Metadata) -> bool {
            true
        }

        fn log(&self, record: &log::Record) {
            match record.level() {
                log::Level::Trace => log(record
                    .args()
                    .as_str()
                    .unwrap_or(record.args().to_string().as_str())),
                log::Level::Debug => debug(
                    record
                        .args()
                        .as_str()
                        .unwrap_or(record.args().to_string().as_str()),
                ),
                log::Level::Info => info(
                    record
                        .args()
                        .as_str()
                        .unwrap_or(record.args().to_string().as_str()),
                ),
                log::Level::Warn => warn(
                    record
                        .args()
                        .as_str()
                        .unwrap_or(record.args().to_string().as_str()),
                ),
                log::Level::Error => error(
                    record
                        .args()
                        .as_str()
                        .unwrap_or(record.args().to_string().as_str()),
                ),
            }
        }

        fn flush(&self) {}
    }

    pub fn init() {
        Logger.init();
    }

    #[wasm_bindgen]
    extern "C" {
        #[wasm_bindgen(js_namespace = console)]
        fn error(s: &str);
        #[wasm_bindgen(js_namespace = console)]
        fn warn(s: &str);
        #[wasm_bindgen(js_namespace = console)]
        fn info(s: &str);
        #[wasm_bindgen(js_namespace = console)]
        fn debug(s: &str);
        #[wasm_bindgen(js_namespace = console)]
        fn log(s: &str);
    }
}

#[wasm_bindgen]
pub async fn app_init(name: String, email: String, password: String) {
    crate::log::init();

    console_error_panic_hook::set_once();

    let app = yelken::router().await;

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
    ::log::info!("Received {uri}, {header_keys:?}, {header_values:?}");

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
