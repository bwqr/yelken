use anyhow::{Context, Result};

pub struct Config {
    pub storage_dir: String,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        let storage_dir =
            std::env::var("YELKEN_STORAGE_DIR").context("YELKEN_STORAGE_DIR is not defined")?;

        Ok(Self { storage_dir })
    }
}
