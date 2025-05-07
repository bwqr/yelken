use base::models::ContentStage;
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FilterByModel {
    pub model_id: i32,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelField {
    pub id: i32,
    pub field_id: i32,
    pub model_id: i32,
    pub name: String,
    pub localized: bool,
    pub multiple: bool,
    pub required: bool,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Model {
    pub id: i32,
    pub namespace: Option<String>,
    pub name: String,
    pub fields: Vec<ModelField>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateModelField {
    pub field_id: i32,
    pub name: String,
    pub localized: bool,
    pub multiple: bool,
    pub required: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateModel {
    pub name: String,
    pub model_fields: Vec<CreateModelField>,
    pub theme_scoped: bool,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentValue {
    pub model_field_id: i32,
    pub value: String,
    pub locale: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateContent {
    pub model_id: i32,
    pub name: String,
    pub values: Vec<ContentValue>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateContentStage {
    pub stage: ContentStage,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateContentValue {
    pub value: String,
}
