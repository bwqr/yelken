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
    pub name: String,
}

#[derive(Deserialize, Serialize)]
pub struct ModelField {
    pub id: i32,
    pub model_id: i32,
    pub field_id: i32,
    pub name: String,
}

#[derive(Deserialize, Serialize)]
pub struct ModelWithFields {
    pub model: Model,
    pub fields: Vec<ModelField>,
}

#[derive(Deserialize, Serialize)]
pub struct CreateModel {
    pub name: String,
    pub model_fields: Vec<(i32, String)>,
}
