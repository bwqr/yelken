use serde::{Deserialize, Serialize};

#[derive(Clone, Deserialize, Serialize)]
pub struct Plugin {
    pub id: i32,
    pub name: String,
}
