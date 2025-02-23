use leptos::prelude::IntoAny;
use send_wrapper::SendWrapper;
use shared::{plugin::Plugin, user::User};
use ui::{App, AppProps, Auth, AuthProps, Config, PluginResource, UserResource};

mod log;

#[cfg(all(feature = "hydrate", feature = "csr"))]
compile_error!("feature \"hydrate\" and feature \"csr\" cannot be enabled at the same time");

enum Root {
    Auth,
    App,
}

#[derive(Clone)]
struct PluginResources {
    config: Config,
}

impl PluginResource for PluginResources {
    async fn fetch_plugins(&self) -> Result<Vec<Plugin>, String> {
        SendWrapper::new(async move {
            let window = web_sys::window().unwrap();

            let token = window
                .local_storage()
                .unwrap()
                .unwrap()
                .get_item("token")
                .unwrap()
                .unwrap_or("".to_string());

            let resp = reqwest::Client::new()
                .get(format!("{}/api/plugin/plugins", self.config.api_url))
                .header(reqwest::header::AUTHORIZATION, format!("Bearer {token}"))
                .send()
                .await
                .map_err(|err| format!("{err:?}"))?;

            if resp.status() == 401 {
                window
                    .location()
                    .assign(&format!("{}/auth/login", self.config.base))
                    .unwrap();

                return Err("Unauthorized error".to_string());
            }

            resp.json().await.map_err(|err| format!("{err:?}"))
        })
        .await
    }
}

struct UserResources {
    config: Config,
}

impl UserResource for UserResources {
    async fn fetch_user(&self) -> Result<User, String> {
        SendWrapper::new(async move {
            let window = web_sys::window().unwrap();

            let token = window
                .local_storage()
                .unwrap()
                .unwrap()
                .get_item("token")
                .unwrap()
                .unwrap_or("".to_string());

            let resp = reqwest::Client::new()
                .get(format!("{}/api/user/profile", self.config.api_url))
                .header(reqwest::header::AUTHORIZATION, format!("Bearer {token}"))
                .send()
                .await
                .map_err(|err| format!("{err:?}"))?;

            if resp.status() == 401 {
                window
                    .location()
                    .assign(&format!("{}/auth/login", self.config.base))
                    .unwrap();

                return Err("Unauthorized error".to_string());
            }

            resp.json().await.map_err(|err| format!("{err:?}"))
        })
        .await
    }
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
            let user_resource = UserResources {
                config: config.clone(),
            };

            let plugin_resource = PluginResources {
                config: config.clone(),
            };

            App(AppProps {
                config,
                user_resource,
                plugin_resource,
            })
            .into_any()
        }
        Root::Auth => Auth(AuthProps { config }).into_any(),
    });
}
