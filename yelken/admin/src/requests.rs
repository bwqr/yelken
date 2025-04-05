use serde::Deserialize;

use crate::SafePath;

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
pub struct UpdateTemplate {
    pub theme_scoped: bool,
    pub path: SafePath<3>,
    pub template: String,
}

#[derive(Deserialize)]
pub struct DeleteTemplate {
    pub theme_scoped: bool,
    pub path: SafePath<3>,
}
