use base::{config::LocationKind, middlewares::permission::Permission, models::Role};
use serde::Serialize;

#[derive(Serialize)]
pub struct CreatedUser {
    pub id: i32,
    pub username: String,
    pub name: String,
    pub email: String,
}

#[derive(serde::Serialize)]
pub struct Template {
    pub path: String,
    pub kind: LocationKind,
}

#[derive(serde::Serialize)]
pub struct TemplateDetail {
    pub path: String,
    pub kind: LocationKind,
    pub template: String,
}

#[derive(Serialize)]
pub struct LocaleResource {
    pub resource: String,
    pub kind: LocationKind,
}

#[derive(Serialize)]
pub struct RoleDetail {
    #[serde(flatten)]
    pub role: Role,
    pub permissions: Vec<Permission>,
}
