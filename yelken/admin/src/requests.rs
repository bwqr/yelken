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
