use serde::Serialize;

#[derive(Serialize)]
pub struct User {
    pub id: i32,
    pub name: String,
}
