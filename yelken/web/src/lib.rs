use ui::{SimpleCounter, SimpleCounterProps};

mod log;

#[wasm_bindgen::prelude::wasm_bindgen]
pub fn hydrate() {
    log::init();

    console_error_panic_hook::set_once();

    leptos::mount::hydrate_body(|| SimpleCounter(SimpleCounterProps { initial_value: 32 }));
}
