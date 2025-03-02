mod bindings;

use bindings::handler;
use bindings::management;
use bindings::plugin;
use leptos::prelude::*;

struct Plugin;

impl plugin::init::Guest for Plugin {
    fn register(_: plugin::init::HostInfo) -> plugin::init::PluginInfo {
        use plugin::init::{Impl, PluginInfo};

        PluginInfo {
            id: "yelken.editor".to_string(),
            version: "0.1.0".to_string(),
            impls: vec![
                Impl {
                    namespace: "yelken".to_string(),
                    name: "management".to_string(),
                    version: "0.1.0".to_string(),
                    iface: "menu".to_string(),
                },
                Impl {
                    namespace: "yelken".to_string(),
                    name: "handler".to_string(),
                    version: "0.1.0".to_string(),
                    iface: "init".to_string(),
                },
            ],
        }
    }
}

impl management::menu::Guest for Plugin {
    fn register() -> Vec<management::menu::Menu> {
        use management::menu::Menu;

        vec![Menu {
            path: "writing".to_string(),
            name: "Writing Settings for me".to_string(),
        }]
    }
}

impl handler::init::Guest for Plugin {
    fn register() -> Vec<handler::init::Reg> {
        use handler::init::{Hook, Reg};

        vec![
            Reg {
                path: "/".to_string(),
                hook: Hook::PreLoad,
            },
            Reg {
                path: "/".to_string(),
                hook: Hook::Loading,
            },
        ]
    }
}

#[component]
fn Button() -> impl IntoView {
    view! {
        <button>"Hello World"</button>
    }
}

impl handler::page::Guest for Plugin {
    fn pre_load(req: handler::page::Request) {
        println!("received a request with url {}", req.url);
    }

    fn loading(req: handler::page::Request, mut page: handler::page::Page) -> handler::page::Page {
        page.body = format!("Replaced all the body with url {}", req.url);

        page
    }

    fn loaded(page: handler::page::Page) -> handler::page::Page {
        page
    }

    fn post_load(req: handler::page::Request) {
        println!("received a request with url {}", req.url);
    }

    fn render(id: String, opts: Vec<String>) -> String {
        Button().to_html()
    }
}

bindings::plugin::export!(Plugin with_types_in bindings::plugin);
bindings::management::export!(Plugin with_types_in bindings::management);
bindings::handler::export!(Plugin with_types_in bindings::handler);
