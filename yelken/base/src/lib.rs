use std::{ops::Deref, sync::Arc};

use config::Config;

pub mod config;
pub mod crypto;
pub mod middlewares;
pub mod models;
pub mod schema;
pub mod types;

#[derive(Clone)]
pub struct AppState(Arc<Inner>);

impl Deref for AppState {
    type Target = Inner;

    fn deref(&self) -> &Self::Target {
        &*self.0
    }
}

impl AppState {
    pub fn new(config: Config, pool: types::Pool) -> Self {
        Self(Arc::new(Inner { config, pool }))
    }
}

pub struct Inner {
    pub config: Config,
    pub pool: types::Pool,
}
