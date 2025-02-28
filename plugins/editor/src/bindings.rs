pub mod plugin {
    mod root {
        wit_bindgen::generate!({
            world: "root",
            path: "../../wit/plugin",
        });
    }

    pub(crate) use root::export;
    pub use root::exports;
    pub use root::exports::yelken::plugin::init;
}

pub mod management {
    mod root {
        wit_bindgen::generate!({
            world: "root",
            path: "../../wit/management",
        });
    }

    pub(crate) use root::export;
    pub use root::exports;
    pub use root::exports::yelken::management::menu;
}

pub mod handler {
    mod root {
        wit_bindgen::generate!({
            world: "root",
            path: "../../wit/handler",
        });
    }

    pub(crate) use root::export;
    pub use root::exports;
    pub use root::exports::yelken::handler::{init, page};
}
