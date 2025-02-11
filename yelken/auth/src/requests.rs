use serde::Deserialize;

#[derive(Deserialize)]
pub struct Login {
    pub email: String,
    pub password: String,
}

#[derive(Deserialize)]
pub struct SignUp {
    pub name: String,
    pub email: String,
    pub password: String,
}
