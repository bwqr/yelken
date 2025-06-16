use base::models::{Content, ContentValue};
use serde::Serialize;

#[derive(Serialize)]
pub struct User {
    pub id: i32,
    pub name: String,
}

#[derive(Serialize)]
pub struct ContentDetails {
    pub content: Content,
    pub values: Vec<ContentValue>,
    pub user: Option<User>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Options {
    pub theme: String,
    pub default_locale: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Model {
    #[serde(flatten)]
    pub model: base::models::Model,
    pub fields: Vec<base::models::ModelField>,
}
