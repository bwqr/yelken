use base::{config::LocationKind, services::SafePath};
use serde::Deserialize;

#[derive(Deserialize)]
pub struct CreateUser {
    pub name: String,
    pub email: String,
    pub password: String,
}

#[derive(Deserialize)]
pub struct CreateRole {
    pub name: String,
}

#[derive(Deserialize)]
pub struct CreateLocale {
    pub key: String,
    pub name: String,
}

#[derive(Deserialize)]
pub struct UpdateLocaleState {
    pub disabled: bool,
}

#[derive(Deserialize)]
pub struct UpdateLocaleResource {
    pub theme_scoped: bool,
    pub resource: String,
}

#[derive(Deserialize)]
pub struct DeleteLocaleResource {
    pub theme_scoped: bool,
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
