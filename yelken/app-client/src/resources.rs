use std::{future::Future, pin::Pin, sync::Arc};

use app::{Config, ContentResource, PluginResource, UserResource};
use send_wrapper::SendWrapper;
use shared::{
    content::{Field, Model},
    plugin::Plugin,
    user::User,
};

#[derive(Clone)]
pub struct PluginResources {
    config: Config,
}

impl PluginResources {
    pub fn new(config: Config) -> Self {
        Self { config }
    }
}

#[cfg(feature = "plugin")]
impl PluginResource for PluginResources {
    fn fetch_plugins(&self) -> Pin<Box<dyn Future<Output = Result<Vec<Plugin>, String>> + Send>> {
        let url = format!("{}/api/plugin/plugins", self.config.api_url);
        let login = format!("{}/auth/login", self.config.base);

        Box::pin(SendWrapper::new(async move {
            let window = web_sys::window().unwrap();

            let token = window
                .local_storage()
                .unwrap()
                .unwrap()
                .get_item("token")
                .unwrap()
                .unwrap_or("".to_string());

            let resp = reqwest::Client::new()
                .get(url)
                .header(reqwest::header::AUTHORIZATION, format!("Bearer {token}"))
                .send()
                .await
                .map_err(|err| format!("{err:?}"))?;

            if resp.status() == 401 {
                window.location().assign(&login).unwrap();

                return Err("Unauthorized error".to_string());
            }

            resp.json().await.map_err(|err| format!("{err:?}"))
        }))
    }
}

#[cfg(not(feature = "plugin"))]
impl PluginResource for PluginResources {
    fn fetch_plugins(&self) -> Pin<Box<dyn Future<Output = Result<Vec<Plugin>, String>> + Send>> {
        Box::pin(async { Err("Feature is not enabled".to_string()) })
    }
}

pub struct UserResources {
    config: Config,
}

impl UserResources {
    pub fn new(config: Config) -> Self {
        Self { config }
    }
}

impl UserResource for UserResources {
    fn fetch_user(&self) -> Pin<Box<dyn Future<Output = Result<User, String>> + Send>> {
        let url = format!("{}/api/user/profile", self.config.api_url);
        let login = format!("{}/auth/login", self.config.base);

        Box::pin(SendWrapper::new(async move {
            let window = web_sys::window().unwrap();

            let token = window
                .local_storage()
                .unwrap()
                .unwrap()
                .get_item("token")
                .unwrap()
                .unwrap_or("".to_string());

            let resp = reqwest::Client::new()
                .get(url)
                .header(reqwest::header::AUTHORIZATION, format!("Bearer {token}"))
                .send()
                .await
                .map_err(|err| format!("{err:?}"))?;

            if resp.status() == 401 {
                window.location().assign(&login).unwrap();

                return Err("Unauthorized error".to_string());
            }

            resp.json().await.map_err(|err| format!("{err:?}"))
        }))
    }
}

pub struct ContentResources {
    config: Config,
}

impl ContentResources {
    pub fn new(config: Config) -> Self {
        Self { config }
    }
}

impl ContentResource for ContentResources {
    fn fetch_models(&self) -> Pin<Box<dyn Future<Output = Result<Arc<[Model]>, String>> + Send>> {
        let url = format!("{}/api/content/models", self.config.api_url);
        let login = format!("{}/auth/login", self.config.base);

        Box::pin(SendWrapper::new(async move {
            let window = web_sys::window().unwrap();

            let token = window
                .local_storage()
                .unwrap()
                .unwrap()
                .get_item("token")
                .unwrap()
                .unwrap_or("".to_string());

            let resp = reqwest::Client::new()
                .get(url)
                .header(reqwest::header::AUTHORIZATION, format!("Bearer {token}"))
                .send()
                .await
                .map_err(|err| format!("{err:?}"))?;

            if resp.status() == 401 {
                window.location().assign(&login).unwrap();

                return Err("Unauthorized error".to_string());
            }

            resp.json().await.map_err(|err| format!("{err:?}"))
        }))
    }

    fn fetch_fields(&self) -> Pin<Box<dyn Future<Output = Result<Arc<[Field]>, String>> + Send>> {
        let url = format!("{}/api/content/fields", self.config.api_url);
        let login = format!("{}/auth/login", self.config.base);

        Box::pin(SendWrapper::new(async move {
            let window = web_sys::window().unwrap();

            let token = window
                .local_storage()
                .unwrap()
                .unwrap()
                .get_item("token")
                .unwrap()
                .unwrap_or("".to_string());

            let resp = reqwest::Client::new()
                .get(url)
                .header(reqwest::header::AUTHORIZATION, format!("Bearer {token}"))
                .send()
                .await
                .map_err(|err| format!("{err:?}"))?;

            if resp.status() == 401 {
                window.location().assign(&login).unwrap();

                return Err("Unauthorized error".to_string());
            }

            resp.json().await.map_err(|err| format!("{err:?}"))
        }))
    }
}
