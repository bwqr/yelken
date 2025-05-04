use std::{ops::Deref, sync::Arc};

use config::Config;
use opendal::Operator;
use types::Pool;

pub mod config;
pub mod crypto;
pub mod middlewares;
pub mod models;
pub mod permission;
pub mod responses;
pub mod schema;
pub mod test;
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
    pub fn new(config: Config, pool: Pool, storage: Operator) -> Self {
        Self(Arc::new(Inner {
            config,
            pool,
            storage,
        }))
    }
}

pub struct Inner {
    pub config: Config,
    pub pool: Pool,
    pub storage: Operator,
}
