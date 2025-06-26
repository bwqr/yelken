use base::services::SafePath;
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

#[derive(Deserialize)]
pub struct UpdateTemplate {
    pub namespace: Option<SafePath<1>>,
    pub path: SafePath<3>,
    pub template: String,
}

#[derive(Deserialize)]
pub struct FilterPath {
    pub path: SafePath<3>,
}
