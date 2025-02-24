use std::ops::Deref;
use std::sync::Arc;

use anyhow::{Context, Result};
use base::types::Connection;
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use log::{info, warn};
use shared::plugin::Menu;
use wasmtime::component::{Component, Linker, ResourceTable};
use wasmtime::{Config, Engine, Store};
use wasmtime_wasi::WasiCtxBuilder;

use base::schema::plugins;

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
    pub async fn new(base_dir: &str, mut conn: Connection<'_>) -> Result<Self> {
        let plugin_names = plugins::table
            .select((plugins::id, plugins::version))
            .filter(plugins::enabled.eq(true))
            .load::<(String, String)>(&mut conn)
            .await?;

        info!("loading plugins {:?}", plugin_names);

        let mut config = Config::new();
        config.async_support(true);

        let engine = Engine::new(&config).unwrap();
        let mut linker = Linker::new(&engine);
        wasmtime_wasi::add_to_linker_async(&mut linker)?;

        let mut plugins = vec![];

        for (id, version) in plugin_names.into_iter() {
            let path = format!("{}/{}@{}.wasm", base_dir, id, version);

            let Some(component) = Component::from_file(&engine, &path)
                .inspect_err(|e| warn!("failed to read file as component, {path}, {e:?}"))
                .ok()
            else {
                continue;
            };

            let Some(plugin) = Plugin::new(id.clone(), component, &engine, &linker)
                .await
                .inspect_err(|e| warn!("failed to construct plugin, {path}, {e:?}"))
                .ok()
            else {
                continue;
            };

            if plugin.id != *id || plugin.version != *version {
                log::warn!(
                    "mismatched plugin name or version, expected {}@{}, received {}@{}",
                    id,
                    version,
                    plugin.id,
                    plugin.version
                );
            } else {
                plugins.push(plugin);
            }
        }

        Ok(Self(Arc::new(Inner {
            engine,
            linker,
            plugins,
        })))
    }
}

pub struct Inner {
    engine: Engine,
    linker: Linker<ComponentRunState>,
    plugins: Vec<Plugin>,
}

impl Inner {
    pub fn plugin_menus(&self, id: &str) -> Option<Vec<Menu>> {
        self.plugins
            .iter()
            .find(|plugin| plugin.id == *id)
            .map(|plugin| plugin.menus.clone())
            .unwrap_or(None)
    }

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
