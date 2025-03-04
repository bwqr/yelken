use leptos::prelude::IntoAny;
use resources::{ContentResources, PluginResources, UserResources};
use ui::{App, AppProps, Auth, AuthProps, Config};

mod log;
mod resources;

#[cfg(all(feature = "hydrate", feature = "csr"))]
compile_error!("feature \"hydrate\" and feature \"csr\" cannot be enabled at the same time");

enum Root {
    Auth,
    App,
}

fn main() {
    log::init();

    console_error_panic_hook::set_once();

    let base = if cfg!(feature = "csr") { "" } else { "/yk-app" };

    #[cfg(not(feature = "csr"))]
    let mount = leptos::mount::hydrate_body;
    #[cfg(feature = "csr")]
    let mount = leptos::mount::mount_to_body;

    let location = web_sys::window().unwrap().location();

    let root = if location
        .pathname()
        .unwrap()
        .starts_with(&format!("{}/auth", base))
    {
        Root::Auth
    } else {
        Root::App
    };

    // let api_url = format!(
    //     "{}//{}",
    //     location.protocol().unwrap(),
    //     location.host().unwrap()
    // );
    let api_url = "http://127.0.0.1:3000".to_string();

    let config = Config::new(base.to_string(), api_url);

    mount(move || match root {
        Root::App => {
            let user_resource = UserResources::new(config.clone());

            let plugin_resource = PluginResources::new(config.clone());

            let content_resource = ContentResources::new(config.clone());

            App(AppProps {
                config,
                user_resource,
                plugin_resource,
                content_resource,
            })
            .into_any()
        }
        Root::Auth => Auth(AuthProps { config }).into_any(),
    });
}
