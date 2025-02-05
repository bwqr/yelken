use anyhow::{Context, Result};
use log::info;
use wasmtime::{
    component::{Component, Linker, ResourceTable},
    Engine, Store,
};
use wasmtime_wasi::{WasiCtx, WasiCtxBuilder, WasiView};

mod bindings;
mod host;

pub use host::PluginHost;

pub(crate) struct ComponentRunState {
    pub wasi_ctx: WasiCtx,
    pub resource_table: ResourceTable,
}

impl WasiView for ComponentRunState {
    fn ctx(&mut self) -> &mut WasiCtx {
        &mut self.wasi_ctx
    }

    fn table(&mut self) -> &mut ResourceTable {
        &mut self.resource_table
    }
}

pub(crate) struct Plugin {
    name: String,
    component: Component,
    events: Vec<String>,
}

impl Plugin {
    async fn new(
        component: Component,
        engine: &Engine,
        linker: &Linker<ComponentRunState>,
    ) -> Result<Self> {
        use crate::bindings::plugin::exports::yelken::plugin::init::{HostInfo, PluginInfo};

        let wasi = WasiCtxBuilder::new()
            .inherit_stdout()
            .inherit_stderr()
            .build();

        let state = ComponentRunState {
            wasi_ctx: wasi,
            resource_table: ResourceTable::new(),
        };

        let mut store = Store::new(&engine, state);

        let instance = linker.instantiate_async(&mut store, &component).await?;

        let interface_idx = instance
            .get_export(&mut store, None, "yelken:plugin/init@0.1.0")
            .context("Cannot get `yelken:plugin/init@0.1.0` interface")?;

        let parent_export_idx = Some(&interface_idx);

        let func_idx = instance
            .get_export(&mut store, parent_export_idx, "register")
            .context("Cannot get `register` function in `yelken:plugin/init@0.1.0` interface")?;

        let func = instance
            .get_func(&mut store, func_idx)
            .expect("Unreachable since we've got func_idx");

        let typed = func.typed::<(HostInfo,), (PluginInfo,)>(&store)?;

        let (plugin,) = typed
            .call_async(
                &mut store,
                (HostInfo {
                    environment: "dev".to_string(),
                    version: "0.1.0".to_string(),
                },),
            )
            .await?;

        typed.post_return_async(&mut store).await?;

        info!(
            "Loaded plugin {} with events {:?}",
            plugin.name, plugin.events
        );

        Ok(Self {
            name: plugin.name,
            component,
            events: plugin.events,
        })
    }
}
