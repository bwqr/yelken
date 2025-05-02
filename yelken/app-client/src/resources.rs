use std::{future::Future, pin::Pin, sync::Arc};

use app::{BaseResource, ContentResource, PluginResource, UserResource};
use send_wrapper::SendWrapper;
use shared::{
    content::{Field, Model},
    plugin::Plugin,
    user::User,
};

#[derive(Clone)]
pub struct PluginResources {
    base: BaseResource,
}

impl PluginResources {
    pub fn new(base: BaseResource) -> Self {
        Self { base }
    }
}

impl PluginResource for PluginResources {
    fn fetch_plugins(&self) -> Pin<Box<dyn Future<Output = Result<Vec<Plugin>, String>> + Send>> {
        #[cfg(feature = "plugin")]
        return self.base.fetch_resource("/api/plugin/plugins");

        #[cfg(not(feature = "plugin"))]
        return {
            // To prevent unused warning
            let _ = &self.base;

            Box::pin(async { Err("Feature is not enabled".to_string()) })
        };
    }
}

pub struct UserResources {
    base: BaseResource,
}

impl UserResources {
    pub fn new(base: BaseResource) -> Self {
        Self { base }
    }
}

impl UserResource for UserResources {
    fn fetch_user(&self) -> Pin<Box<dyn Future<Output = Result<User, String>> + Send>> {
        Box::pin(SendWrapper::new(self.base.get("/api/user/profile")))
    }
}

pub struct ContentResources {
    base: BaseResource,
}

impl ContentResources {
    pub fn new(base: BaseResource) -> Self {
        Self { base }
    }
}

impl ContentResource for ContentResources {
    fn fetch_models(&self) -> Pin<Box<dyn Future<Output = Result<Arc<[Model]>, String>> + Send>> {
        Box::pin(SendWrapper::new(self.base.get("/api/content/models")))
    }

    fn fetch_fields(&self) -> Pin<Box<dyn Future<Output = Result<Arc<[Field]>, String>> + Send>> {
        Box::pin(SendWrapper::new(self.base.get("/api/content/fields")))
    }
}
