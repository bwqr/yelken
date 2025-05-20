use std::{future::IntoFuture, ops::Deref, sync::Arc};

use config::Config;
use opendal::Operator;
use types::Pool;

pub mod async_sqlite;
pub mod config;
pub mod crypto;
pub mod middlewares;
pub mod models;
pub mod permission;
pub mod responses;
pub mod schema;
pub mod test;
pub mod types;

pub trait IntoSendFuture {
    type Output;

    type IntoFuture: std::future::Future<Output = Self::Output>;

    fn into_send_future(self) -> Self::IntoFuture;
}

#[cfg(not(target_family = "wasm"))]
impl<T: IntoFuture + Send> IntoSendFuture for T {
    type Output = T::Output;

    type IntoFuture = T::IntoFuture;

    fn into_send_future(self) -> Self::IntoFuture {
        self.into_future()
    }
}

#[cfg(target_family = "wasm")]
impl<T: IntoFuture> IntoSendFuture for T {
    type Output = T::Output;

    type IntoFuture = send_wrapper::SendWrapper<T::IntoFuture>;

    fn into_send_future(self) -> Self::IntoFuture {
        send_wrapper::SendWrapper::new(self.into_future())
    }
}

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
