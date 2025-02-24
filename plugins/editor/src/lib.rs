mod bindings;

use bindings::plugin::exports::yelken::plugin;

struct Plugin;

impl plugin::init::Guest for Plugin {
    fn register(_: plugin::init::HostInfo) -> plugin::init::PluginInfo {
        plugin::init::PluginInfo {
            name: "yelken.editor".to_string(),
            version: "0.1.0".to_string(),
            management: plugin::init::Management {
                menus: Some(vec![plugin::init::Menu {
                    path: "/".to_string(),
                    name: "Yelken Editor".to_string(),
                }]),
            },
        }
    }
}

bindings::plugin::export!(Plugin with_types_in bindings::plugin);
