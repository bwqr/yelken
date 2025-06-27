use std::{ops::Deref, sync::Arc};

use config::Config;
use db::Pool;
use opendal::Operator;

pub mod config;
pub mod crypto;
pub mod db;
pub mod middlewares;
pub mod models;
pub mod paginate;
pub mod permission;
pub mod responses;
pub mod runtime;
pub mod sanitize;
pub mod schema;
pub mod services;
pub mod test;
pub mod utils;
pub mod validate;

#[derive(Clone)]
pub struct AppState(Arc<Inner>);

impl Deref for AppState {
    type Target = Inner;

    fn deref(&self) -> &Self::Target {
        &*self.0
    }
}

impl AppState {
    pub fn new(config: Config, pool: Pool, storage: Operator, tmp_storage: Operator) -> Self {
        Self(Arc::new(Inner {
            config,
            pool,
            storage,
            tmp_storage,
        }))
    }
}

pub struct Inner {
    pub config: Config,
    pub pool: Pool,
    pub storage: Operator,
    pub tmp_storage: Operator,
}
