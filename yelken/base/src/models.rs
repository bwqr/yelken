use std::io::Write;

use chrono::NaiveDateTime;
use diesel::{
    deserialize::{FromSql, FromSqlRow},
    expression::AsExpression,
    pg::{Pg, PgValue},
    prelude::Queryable,
    serialize::{IsNull, Output, ToSql},
    sql_types::Text,
};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, PartialEq, AsExpression, FromSqlRow)]
#[diesel(sql_type = Text)]
#[serde(rename_all = "snake_case")]
pub enum UserState {
    Enabled,
    Disabled,
}

impl ToSql<Text, Pg> for UserState {
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Pg>) -> diesel::serialize::Result {
        match *self {
            UserState::Enabled => out.write_all(b"enabled")?,
            UserState::Disabled => out.write_all(b"disabled")?,
        }

        Ok(IsNull::No)
    }
}

impl FromSql<Text, Pg> for UserState {
    fn from_sql(bytes: PgValue) -> diesel::deserialize::Result<Self> {
        match bytes.as_bytes() {
            b"enabled" => Ok(UserState::Enabled),
            b"disabled" => Ok(UserState::Disabled),
            _ => Err("Unrecognized enum variant".into()),
        }
    }
}

#[derive(Clone, Debug, PartialEq, AsExpression, FromSqlRow)]
#[diesel(sql_type = Text)]
pub enum LoginKind {
    Email,
    Saas,
}

impl ToSql<Text, Pg> for LoginKind {
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Pg>) -> diesel::serialize::Result {
        match *self {
            LoginKind::Email => out.write_all(b"email")?,
            LoginKind::Saas => out.write_all(b"saas")?,
        }

        Ok(IsNull::No)
    }
}

impl FromSql<Text, Pg> for LoginKind {
    fn from_sql(bytes: PgValue) -> diesel::deserialize::Result<Self> {
        match bytes.as_bytes() {
            b"email" => Ok(LoginKind::Email),
            b"saas" => Ok(LoginKind::Saas),
            _ => Err("Unrecognized enum variant".into()),
        }
    }
}

#[derive(Queryable)]
pub struct User {
    pub id: i32,
    pub role_id: Option<i32>,
    pub username: String,
    pub name: String,
    pub email: String,
    pub password: Option<String>,
    pub login_kind: LoginKind,
    pub state: UserState,
    pub openid: Option<String>,
    pub created_at: NaiveDateTime,
}

#[derive(Queryable, Serialize)]
pub struct Role {
    pub id: i32,
    pub name: String,
    pub created_at: NaiveDateTime,
}

#[derive(Queryable, Serialize)]
pub struct Locale {
    pub key: String,
    pub name: String,
    pub disabled: bool,
}

#[derive(Queryable)]
pub struct Model {
    pub id: i32,
    pub namespace: Option<String>,
    pub name: String,
}

#[derive(Queryable)]
pub struct Field {
    pub id: i32,
    pub name: String,
    pub kind: String,
}

#[derive(Queryable)]
pub struct ModelField {
    pub id: i32,
    pub field_id: i32,
    pub model_id: i32,
    pub name: String,
    pub localized: bool,
    pub multiple: bool,
    pub required: bool,
}

#[derive(Queryable)]
pub struct Content {
    pub id: i32,
    pub model_id: i32,
    pub name: String,
    pub created_at: NaiveDateTime,
}
