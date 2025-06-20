use base::{services::SafePath, utils::LocationKind};
use serde::Deserialize;

#[derive(Deserialize)]
pub struct CreateUser {
    pub name: String,
    pub email: String,
    pub password: String,
}

#[derive(Deserialize)]
pub struct CreateRole {
    pub key: String,
    pub name: String,
    pub desc: Option<String>,
}

#[derive(Deserialize)]
pub struct CreateLocale {
    pub key: String,
    pub name: String,
}

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
pub struct UpdateLocaleState {
    pub disabled: bool,
}

#[derive(Deserialize)]
pub struct FilterLocaleResource {
    #[serde(flatten)]
    pub kind: LocationKind,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateLocaleResource {
    pub resource: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTemplate {
    pub theme_scoped: bool,
    pub path: SafePath<3>,
    pub template: String,
}

#[derive(Deserialize)]
pub struct FilterTemplate {
    pub kind: LocationKind,
    pub path: SafePath<3>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteTemplate {
    pub theme_scoped: bool,
    pub path: SafePath<3>,
}

#[derive(Deserialize)]
pub struct UpdateTheme {
    pub theme: String,
}

#[derive(Deserialize)]
pub struct UpdateDefaultLocale {
    pub locale: String,
}

#[derive(Deserialize)]
pub struct UpdateLocale {
    pub name: String,
}
