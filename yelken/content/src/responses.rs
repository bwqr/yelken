use base::models::{Content, ContentValue};
use serde::Serialize;

#[derive(Serialize)]
pub struct ContentWithValues {
    pub content: Content,
    pub values: Vec<ContentValue>,
}
