use std::{ops::Deref, sync::Arc};

#[derive(Clone)]
pub struct Config(Arc<Inner>);

impl Config {
    pub fn new(base: String, api_url: String) -> Self {
        Self(Arc::new(Inner { base, api_url }))
    }
}

impl Deref for Config {
    type Target = Inner;

    fn deref(&self) -> &Self::Target {
        &*self.0
    }
}

pub struct Inner {
    pub base: String,
    pub api_url: String,
}
