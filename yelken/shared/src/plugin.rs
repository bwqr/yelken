use serde::{Deserialize, Serialize};

#[derive(Clone, Deserialize, Serialize)]
pub struct Menu {
    pub path: String,
    pub name: String,
}

#[derive(Clone, Deserialize, Serialize)]
pub struct Plugin {
    pub id: String,
    pub version: String,
    pub enabled: bool,
    pub name: String,
    pub desc: String,
    pub menus: Option<Vec<Menu>>,
}
