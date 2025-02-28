use std::ops::Deref;
use std::sync::Arc;

use anyhow::{Context, Result};
use base::types::Connection;
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use log::{info, warn};
use shared::plugin::Menu;
use wasmtime::component::{Component, ComponentNamedList, Lift, Linker, Lower, ResourceTable};
use wasmtime::{Config, Engine, Store};
use wasmtime_wasi::{WasiCtx, WasiCtxBuilder, WasiView};

use base::schema::plugins;

use crate::bindings::plugin::init::HostInfo;
use crate::bindings::{handler::init::Reg, plugin::init::PluginInfo};

trait Plugin
where
    Self: Sized,
{
    const INTERFACE: &'static str;
    type Args: ComponentNamedList + Lower + Send + Sync;
    type Ret: ComponentNamedList + Lift + Send + Sync;

    fn new(plugin: Arc<(Component, PluginInfo)>, ret: Self::Ret) -> Self;

    async fn instantiate(
        plugin: Arc<(Component, PluginInfo)>,
        engine: &Engine,
        linker: &Linker<ComponentRunState>,
        args: Self::Args,
    ) -> Result<Self> {
        call::<Self::Args, Self::Ret>(&plugin.0, engine, linker, Self::INTERFACE, "register", args)
            .await
            .map(move |ret| Self::new(plugin, ret))
    }
}

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
        let mut config = Config::new();
        config.async_support(true);

        let engine = Engine::new(&config).unwrap();
        let mut linker = Linker::new(&engine);
        wasmtime_wasi::add_to_linker_async(&mut linker)?;

        let plugin_names = plugins::table
            .select((plugins::id, plugins::version))
            .filter(plugins::enabled.eq(true))
            .load::<(String, String)>(&mut conn)
            .await?;

        info!("loading plugins {:?}", plugin_names);

        let host_info = HostInfo {
            version: "0.1.0".to_string(),
        };

        let mut handlers = vec![];
        let mut managements = vec![];

        for (id, version) in plugin_names.into_iter() {
            let path = format!("{}/{}@{}.wasm", base_dir, id, version);

            let Some(component) = Component::from_file(&engine, &path)
                .inspect_err(|e| warn!("failed to read file as component, {path}, {e:?}"))
                .ok()
            else {
                continue;
            };

            let Ok((info,)) = call::<(&HostInfo,), (PluginInfo,)>(
                &component,
                &engine,
                &linker,
                "yelken:plugin/init@0.1.0",
                "register",
                (&host_info,),
            )
            .await
            .inspect_err(|e| warn!("failed to construct plugin, {path}, {e:?}")) else {
                continue;
            };

            if info.id != *id || info.version != *version {
                log::warn!(
                    "mismatched plugin name or version, expected {}@{}, received {}@{}",
                    id,
                    version,
                    info.id,
                    info.version
                );

                continue;
            }

            let plugin = Arc::new((component, info));

            if plugin
                .1
                .impls
                .iter()
                .find(|i| {
                    i.namespace == "yelken"
                        && i.name == "handler"
                        && i.version == "0.1.0"
                        && i.iface == "init"
                })
                .is_some()
            {
                match HandlerPlugin::instantiate(Arc::clone(&plugin), &engine, &linker, ()).await {
                    Ok(p) => handlers.push(p),
                    Err(e) => log::warn!("Failed to add handler plugin, {e:?}"),
                };
            }

            if plugin
                .1
                .impls
                .iter()
                .find(|i| {
                    i.namespace == "yelken"
                        && i.name == "management"
                        && i.version == "0.1.0"
                        && i.iface == "menu"
                })
                .is_some()
            {
                match ManagementPlugin::instantiate(Arc::clone(&plugin), &engine, &linker, ()).await
                {
                    Ok(p) => managements.push(p),
                    Err(e) => log::warn!("Failed to add management plugin, {e:?}"),
                };
            }
        }

        Ok(Self(Arc::new(Inner {
            engine,
            linker,
            handlers,
            managements,
        })))
    }
}

struct HandlerPlugin {
    plugin: Arc<(Component, PluginInfo)>,
    regs: Vec<Reg>,
}

impl Plugin for HandlerPlugin {
    const INTERFACE: &'static str = "yelken:handler/init@0.1.0";

    type Args = ();

    type Ret = (Vec<Reg>,);

    fn new(plugin: Arc<(Component, PluginInfo)>, (regs,): Self::Ret) -> Self {
        Self { plugin, regs }
    }
}

struct ManagementPlugin {
    plugin: Arc<(Component, PluginInfo)>,
    menus: Arc<[Menu]>,
}

impl Plugin for ManagementPlugin {
    const INTERFACE: &'static str = "yelken:management/menu@0.1.0";

    type Args = ();

    type Ret = (Vec<crate::bindings::management::menu::Menu>,);

    fn new(plugin: Arc<(Component, PluginInfo)>, (menus,): Self::Ret) -> Self {
        Self {
            plugin,
            menus: menus
                .into_iter()
                .map(|m| shared::plugin::Menu {
                    path: m.path,
                    name: m.name,
                })
                .collect(),
        }
    }
}

pub struct Inner {
    engine: Engine,
    linker: Linker<ComponentRunState>,
    handlers: Vec<HandlerPlugin>,
    managements: Vec<ManagementPlugin>,
}

impl Inner {
    pub fn plugin_menus(&self, id: &str) -> Option<Arc<[Menu]>> {
        self.managements
            .iter()
            .find(|p| p.plugin.1.id == *id)
            .map(|p| p.menus.clone())
    }

    pub async fn run_pre_load_handlers(&self, path: &str) -> Result<()> {
        use crate::bindings::handler::{init::Hook, page::Request};

        let handlers = self.handlers.iter().filter(|h| {
            h.regs
                .iter()
                .find(|r| r.hook == Hook::PreLoad && r.path == path)
                .is_some()
        });

        for handler in handlers {
            call::<(Request,), ()>(
                &handler.plugin.0,
                &self.engine,
                &self.linker,
                "yelken:handler/page@0.1.0",
                "pre-load",
                (Request {
                    url: path.to_string(),
                },),
            )
            .await?;
        }

        Ok(())
    }

    pub async fn run_loading_handlers(
        &self,
        path: &str,
        (head, body, scripts): (String, String, String),
    ) -> Result<(String, String, String)> {
        use crate::bindings::handler::{init::Hook, page::Page, page::Request};

        let handlers = self.handlers.iter().filter(|h| {
            h.regs
                .iter()
                .find(|r| r.hook == Hook::Loading && r.path == path)
                .is_some()
        });

        let mut page = Page {
            head,
            body,
            scripts,
        };

        for handler in handlers {
            page = call::<(Request, Page), (Page,)>(
                &handler.plugin.0,
                &self.engine,
                &self.linker,
                "yelken:handler/page@0.1.0",
                "loading",
                (
                    Request {
                        url: path.to_string(),
                    },
                    page,
                ),
            )
            .await?
            .0;
        }

        Ok((page.head, page.body, page.scripts))
    }
}

async fn call<A, R>(
    component: &Component,
    engine: &Engine,
    linker: &Linker<ComponentRunState>,
    interface: &str,
    func: &str,
    args: A,
) -> Result<R>
where
    A: ComponentNamedList + Lower + Send + Sync,
    R: ComponentNamedList + Lift + Send + Sync,
{
    let wasi = WasiCtxBuilder::new()
        .inherit_stdout()
        .inherit_stderr()
        .build();

    let state = ComponentRunState {
        wasi_ctx: wasi,
        resource_table: ResourceTable::new(),
    };

    let mut store = Store::new(&engine, state);

    let instance = linker.instantiate_async(&mut store, component).await?;

    let interface_idx = instance
        .get_export(&mut store, None, interface)
        .context("Cannot get interface")?;

    let parent_export_idx = Some(&interface_idx);

    let func_idx = instance
        .get_export(&mut store, parent_export_idx, func)
        .context("Cannot get function in interface")?;

    let func = instance
        .get_func(&mut store, func_idx)
        .expect("Unreachable since we've got func_idx");

    let typed = func.typed::<A, R>(&store)?;

    let ret = typed.call_async(&mut store, args).await?;

    typed.post_return_async(&mut store).await?;

    Ok(ret)
}
