use base::middlewares::permission::Permission;
use base::models::{LoginKind, UserState};
use chrono::NaiveDateTime;
use diesel::Queryable;
use serde::Serialize;

#[derive(Queryable, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct User {
    pub id: i32,
    pub role_id: Option<i32>,
    pub username: String,
    pub name: String,
    pub email: String,
    pub state: UserState,
    pub login_kind: LoginKind,
    pub created_at: NaiveDateTime,
}

#[derive(Serialize)]
pub struct UserWithPermissions {
    #[serde(flatten)]
    pub user: User,
    pub permissions: Vec<Permission>,
}
