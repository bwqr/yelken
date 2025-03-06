use std::{future::Future, pin::Pin, sync::Arc};

use axum::{extract::State, Extension};
use base::{models::AuthUser, AppState};
use plugin::PluginHost;
use shared::{
    content::{Field, Model},
    plugin::Plugin,
    user::User,
};
use ui::{ContentResource, PluginResource, UserResource};

#[derive(Clone)]
pub struct PluginContext {
    plugin_host: PluginHost,
    state: AppState,
}

impl PluginContext {
    pub fn new(plugin_host: PluginHost, state: AppState) -> Self {
        Self { plugin_host, state }
    }
}

impl PluginResource for PluginContext {
    fn fetch_plugins(&self) -> Pin<Box<dyn Future<Output = Result<Vec<Plugin>, String>> + Send>> {
        let state = self.state.clone();
        let plugin_host = self.plugin_host.clone();

        Box::pin(async move {
            plugin::fetch_plugins(State(state), Extension(plugin_host))
                .await
                .map(|json| json.0)
                .map_err(|e| e.error.to_string())
        })
    }
}

pub struct UserContext {
    user: AuthUser,
}

impl UserContext {
    pub fn new(user: AuthUser) -> Self {
        Self { user }
    }
}

impl UserResource for UserContext {
    fn fetch_user(&self) -> Pin<Box<dyn Future<Output = Result<User, String>> + Send>> {
        let user = User {
            id: self.user.id,
            name: self.user.name.clone(),
        };

        Box::pin(async move { Ok(user) })
    }
}

pub struct ContentContext {
    state: AppState,
}

impl ContentContext {
    pub fn new(state: AppState) -> Self {
        Self { state }
    }
}

impl ContentResource for ContentContext {
    fn fetch_models(&self) -> Pin<Box<dyn Future<Output = Result<Arc<[Model]>, String>> + Send>> {
        let state = self.state.clone();

        Box::pin(async move {
            content::fetch_models(State(state))
                .await
                .map(|models| models.0.into())
                .map_err(|e| format!("Failed to get models {e:?}"))
        })
    }

    fn fetch_fields(&self) -> Pin<Box<dyn Future<Output = Result<Arc<[Field]>, String>> + Send>> {
        let state = self.state.clone();

        Box::pin(async move {
            content::fetch_fields(State(state))
                .await
                .map(|fields| fields.0.into())
                .map_err(|e| format!("Failed to get fields {e:?}"))
        })
    }
}
