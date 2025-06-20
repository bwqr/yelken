use base::{
    middlewares::permission::Permission,
    models::{Role, UserState},
};
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
}

#[derive(serde::Serialize)]
pub struct TemplateDetail {
    pub path: String,
    pub template: String,
}

#[derive(Serialize)]
pub struct LocaleResource {
    pub resource: String,
}

#[derive(Serialize)]
pub struct RoleDetail {
    #[serde(flatten)]
    pub role: Role,
    pub permissions: Vec<Permission>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct User {
    pub id: i32,
    pub role_id: Option<i32>,
    pub username: String,
    pub name: String,
    pub state: UserState,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserDetail {
    #[serde(flatten)]
    pub user: User,
    pub email: String,
    pub permissions: Vec<Permission>,
}
