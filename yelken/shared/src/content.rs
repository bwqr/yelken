use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize)]
pub struct Field {
    pub id: i32,
    pub name: String,
    pub kind: String,
}

#[derive(Deserialize, Serialize)]
pub struct Model {
    pub id: i32,
    pub namespace: Option<String>,
    pub name: String,
}

#[derive(Deserialize, Serialize)]
pub struct CreateModelField {
    pub field_id: i32,
    pub name: String,
    pub localized: bool,
    pub multiple: bool,
    pub required: bool,
}

#[derive(Deserialize, Serialize)]
pub struct CreateModel {
    pub name: String,
    pub model_fields: Vec<CreateModelField>,
    pub theme_scoped: bool,
}

#[derive(Deserialize, Serialize)]
pub struct ContentValue {
    pub model_field_id: i32,
    pub value: String,
    pub locale: Option<String>,
}

#[derive(Deserialize, Serialize)]
pub struct CreateContent {
    pub model_id: i32,
    pub name: String,
    pub values: Vec<ContentValue>,
}
