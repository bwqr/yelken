use serde::Deserialize;

#[derive(Deserialize)]
pub struct CreateUser {
    pub name: String,
    pub email: String,
    pub password: String,
}

#[derive(Deserialize)]
pub struct UpdateUserRole {
    pub role_id: Option<i32>,
}

#[derive(Deserialize)]
pub struct CreateRole {
    pub name: String,
}
