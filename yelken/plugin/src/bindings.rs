pub mod plugin {
    wasmtime::component::bindgen!({
        world: "root",
        path: "../../wit/plugin",
    });
}

pub mod handler {
    wasmtime::component::bindgen!({
        world: "root",
        path: "../../wit/handler",
    });
}
