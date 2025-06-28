use std::collections::HashMap;

use base::{models::ContentStage, sanitize::Sanitize, validate::Validate};
use derive::Sanitize;
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FilterByModel {
    pub model_id: i32,
}

#[derive(Deserialize, Sanitize)]
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

impl Validate for CreateModelField {
    fn validate(&self) -> Result<(), base::validate::Errors> {
        let mut errors = base::validate::Errors::new();

        if self.key.len() < 3 {
            errors.insert_field("key", "at_least_3_chars");
        }

        if self.name.len() < 3 {
            errors.insert_field("name", "at_least_3_chars");
        }

        if self.desc.as_ref().map(|d| d.len() < 3).unwrap_or(false) {
            errors.insert_field("desc", "at_least_3_chars");
        }

        if !errors.is_empty() {
            return Err(errors);
        }

        Ok(())
    }
}

#[derive(Deserialize, Sanitize)]
#[serde(rename_all = "camelCase")]
pub struct CreateModel {
    pub namespace: Option<String>,
    pub key: String,
    pub name: String,
    pub desc: Option<String>,
    pub model_fields: Vec<CreateModelField>,
}

impl Validate for CreateModel {
    fn validate(&self) -> Result<(), base::validate::Errors> {
        let mut errors = base::validate::Errors::new();

        if self.key.len() < 3 {
            errors.insert_field("key", "at_least_3_chars");
        }

        if self.name.len() < 3 {
            errors.insert_field("name", "at_least_3_chars");
        }

        if self.desc.as_ref().map(|d| d.len() < 3).unwrap_or(false) {
            errors.insert_field("desc", "at_least_3_chars");
        }

        let mut model_field_errors = HashMap::new();

        for (idx, mf) in self.model_fields.iter().enumerate() {
            if let Err(e) = mf.validate() {
                model_field_errors.insert(idx, base::validate::Error::Struct(e.field_messages));
            }
        }

        if !model_field_errors.is_empty() {
            errors.field_messages.insert(
                "modelFields",
                base::validate::Error::List(model_field_errors),
            );
        }

        if !errors.is_empty() {
            return Err(errors);
        }

        Ok(())
    }
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

#[derive(Deserialize)]
pub struct UpdateContent {
    pub name: String,
}

#[derive(Deserialize)]
pub struct UpdateAsset {
    pub name: String,
}
