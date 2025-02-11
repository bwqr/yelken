use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize)]
pub struct Token {
    pub token: String,
}
