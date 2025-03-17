use wasm_bindgen::prelude::*;
use log::Log;

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
            log::Level::Trace => log(record.args().as_str().unwrap_or(record.args().to_string().as_str())),
            log::Level::Debug => debug(record.args().as_str().unwrap_or(record.args().to_string().as_str())),
            log::Level::Info => info(record.args().as_str().unwrap_or(record.args().to_string().as_str())),
            log::Level::Warn => warn(record.args().as_str().unwrap_or(record.args().to_string().as_str())),
            log::Level::Error => error(record.args().as_str().unwrap_or(record.args().to_string().as_str())),
        }
    }

    fn flush(&self) {
    }
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
