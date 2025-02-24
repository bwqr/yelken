pub mod plugin {
    wit_bindgen::generate!({
        world: "root",
        path: "../../wit/plugin",
    });
}
