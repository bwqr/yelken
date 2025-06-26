use base::{models::UserState, services::SafePath};
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
pub struct UpdateRole {
    pub name: String,
    pub desc: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateUser {
    pub name: String,
    pub state: UserState,
    pub role_id: Option<i32>,
}

#[derive(Deserialize)]
pub struct UpdateLocaleState {
    pub disabled: bool,
}

#[derive(Deserialize)]
pub struct FilterNamespace {
    pub namespace: Option<SafePath<1>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateLocaleResource {
    pub resource: String,
}

#[derive(Deserialize)]
pub struct UpdateDefaultLocale {
    pub locale: String,
}

#[derive(Deserialize)]
pub struct UpdateLocale {
    pub name: String,
}
