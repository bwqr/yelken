use base::models::ContentStage;
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FilterByModel {
    pub model_id: i32,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateModelField {
    pub field_id: i32,
    pub key: String,
    pub name: String,
    pub desc: Option<String>,
    pub localized: bool,
    pub multiple: bool,
    pub required: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateModel {
    pub namespace: Option<String>,
    pub key: String,
    pub name: String,
    pub desc: Option<String>,
    pub model_fields: Vec<CreateModelField>,
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

#[derive(Deserialize)]
pub struct UpdateModel {
    pub name: String,
    pub desc: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateModelField {
    pub name: String,
    pub desc: Option<String>,
    pub localized: bool,
    pub required: bool,
    pub multiple: bool,
}
