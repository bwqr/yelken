use base::{sanitize::Sanitize, services::SafePath, validate::Validate};
use derive::Sanitize;
use serde::Deserialize;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePage {
    pub namespace: Option<String>,
    pub key: String,
    pub name: String,
    pub desc: Option<String>,
    pub path: String,
    pub template: String,
    pub locale: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdatePage {
    pub name: String,
    pub desc: Option<String>,
}

#[derive(Deserialize)]
pub struct FilterNamespace {
    pub namespace: Option<SafePath<1>>,
}

#[derive(Deserialize)]
pub struct FilterLocale {
    pub locale: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateTheme {
    pub theme: String,
}

#[derive(Deserialize, Sanitize)]
pub struct UpdateTemplate {
    pub namespace: Option<SafePath<1>>,
    pub path: SafePath<3>,
    #[sanitize(skip)]
    pub template: String,
}

impl Validate for UpdateTemplate {
    fn validate(&self) -> Result<(), base::validate::Errors> {
        let mut errors = base::validate::Errors::new();

        if self.path.inner().len() < 3 {
            errors.insert_field("path", "at_least_3_chars");
        } else if !self.path.inner().ends_with(".html") {
            errors.insert_field("path", "not_html");
        }

        if !errors.is_empty() {
            return Err(errors);
        }

        Ok(())
    }
}

#[derive(Deserialize)]
pub struct FilterPath {
    pub path: SafePath<3>,
}
