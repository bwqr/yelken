pub mod plugin {
    mod root {
        wasmtime::component::bindgen!({
            world: "root",
            path: "../../wit/plugin",
        });
    }

    pub use root::exports::yelken::plugin::init;
}

pub mod handler {
    mod root {
        wasmtime::component::bindgen!({
            world: "root",
            path: "../../wit/handler",
        });
    }

    pub use root::exports::yelken::handler::{init, page};
}

pub mod management {
    mod root {
        wasmtime::component::bindgen!({
            world: "root",
            path: "../../wit/management",
        });
    }

    pub use root::exports::yelken::management::menu;
}
