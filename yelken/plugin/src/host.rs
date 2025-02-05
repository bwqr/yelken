use std::ops::Deref;
use std::sync::Arc;

use anyhow::{Context, Result};
use log::warn;
use wasmtime::component::{Component, Linker, ResourceTable};
use wasmtime::{Config, Engine, Store};
use wasmtime_wasi::WasiCtxBuilder;

use crate::bindings::handler::exports::yelken::handler::page;
use crate::{ComponentRunState, Plugin};

#[derive(Clone)]
pub struct PluginHost(Arc<Inner>);

impl Deref for PluginHost {
    type Target = Inner;

    fn deref(&self) -> &Self::Target {
        &*self.0
    }
}

impl PluginHost {
    pub async fn new(base_dir: &str) -> Result<Self> {
        let mut config = Config::new();
        config.async_support(true);

        let engine = Engine::new(&config).unwrap();
        let mut linker = Linker::new(&engine);
        wasmtime_wasi::add_to_linker_async(&mut linker)?;

        let plugin_files = Self::discover_plugin_files(base_dir)?;

        let mut plugins = vec![];

        for path in plugin_files.iter() {
            let Some(component) = Component::from_file(&engine, &path)
                .inspect_err(|e| warn!("failed to read file as component, {path}, {e:?}"))
                .ok()
            else {
                continue;
            };

            let Some(plugin) = Plugin::new(component, &engine, &linker)
                .await
                .inspect_err(|e| warn!("failed to construct plugin, {path}, {e:?}"))
                .ok()
            else {
                continue;
            };

            plugins.push(plugin);
        }

        Ok(Self(Arc::new(Inner {
            engine,
            linker,
            plugins,
        })))
    }

    fn discover_plugin_files(base_dir: &str) -> Result<Vec<String>> {
        Ok(std::fs::read_dir(base_dir)?
            .filter_map(|result| {
                let path = result.ok()?.path();

                if !path.extension()?.to_str()?.ends_with("wasm") {
                    return None;
                }

                path.to_str().map(|p| p.to_string())
            })
            .collect())
    }
}

pub struct Inner {
    engine: Engine,
    linker: Linker<ComponentRunState>,
    plugins: Vec<Plugin>,
}

impl Inner {
    pub async fn process_page_load(&self, url: String, query: String) -> Result<page::Response> {
        let wasi = WasiCtxBuilder::new()
            .inherit_stdout()
            .inherit_stderr()
            .build();

        let state = ComponentRunState {
            wasi_ctx: wasi,
            resource_table: ResourceTable::new(),
        };

        let mut store = Store::new(&self.engine, state);

        let instance = self
            .linker
            .instantiate_async(&mut store, &self.plugins[0].component)
            .await?;

        let interface_idx = instance
            .get_export(&mut store, None, "yelken:handler/page@0.1.0")
            .context("Cannot get `yelken:handler/page@0.1.0` interface")?;

        let parent_export_idx = Some(&interface_idx);

        let func_idx = instance
            .get_export(&mut store, parent_export_idx, "load")
            .context("Cannot get `load` function in `yelken:handler/page@0.1.0` interface")?;

        let func = instance
            .get_func(&mut store, func_idx)
            .expect("Unreachable since we've got func_idx");

        let typed = func.typed::<(page::Request,), (page::Response,)>(&store)?;

        let (response,) = typed
            .call_async(&mut store, (page::Request { url, query },))
            .await?;

        typed.post_return_async(&mut store).await?;

        Ok(response)
    }
}
