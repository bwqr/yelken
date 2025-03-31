use serde::Serialize;

#[derive(Serialize)]
pub struct CreatedUser {
    pub id: i32,
    pub username: String,
    pub name: String,
    pub email: String,
}

#[derive(Serialize)]
pub struct CreatedRole {
    pub id: i32,
    pub name: String,
}
