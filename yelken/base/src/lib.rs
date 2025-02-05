use std::{ops::Deref, sync::Arc};

use config::Config;

pub mod config;
pub mod schema;

#[derive(Clone)]
pub struct AppState(Arc<Inner>);

impl Deref for AppState {
    type Target = Inner;

    fn deref(&self) -> &Self::Target {
        &*self.0
    }
}

impl AppState {
    pub fn new(config: Config) -> Self {
        Self(Arc::new(Inner { config }))
    }
}

pub struct Inner {
    config: Config,
}
