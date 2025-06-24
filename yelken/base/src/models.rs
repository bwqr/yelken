use chrono::NaiveDateTime;
use diesel::{
    deserialize::{FromSql, FromSqlRow},
    expression::AsExpression,
    prelude::Queryable,
    serialize::{Output, ToSql},
    sql_types::Text,
};
use serde::{Deserialize, Serialize};

use crate::db::{Backend, BackendValue};

#[cfg(feature = "sqlite")]
fn read_value_bytes<'a>(value: &'a mut BackendValue) -> &'a [u8] {
    value.read_blob()
}
#[cfg(feature = "postgres")]
fn read_value_bytes<'a>(value: &'a BackendValue) -> &'a [u8] {
    value.as_bytes()
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, AsExpression, FromSqlRow)]
#[diesel(sql_type = Text)]
#[serde(rename_all = "snake_case")]
pub enum UserState {
    Enabled,
    Disabled,
}

impl ToSql<Text, Backend> for UserState {
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Backend>) -> diesel::serialize::Result {
        let value = match self {
            UserState::Enabled => "enabled",
            UserState::Disabled => "disabled",
        };

        <str as ToSql<Text, Backend>>::to_sql(value, out)
    }
}

impl FromSql<Text, Backend> for UserState {
    fn from_sql(mut value: BackendValue) -> diesel::deserialize::Result<Self> {
        match read_value_bytes(&mut value) {
            b"enabled" => Ok(UserState::Enabled),
            b"disabled" => Ok(UserState::Disabled),
            _ => Err("Unrecognized enum variant".into()),
        }
    }
}

#[derive(Clone, Debug, PartialEq, AsExpression, FromSqlRow, Serialize)]
#[diesel(sql_type = Text)]
#[serde(rename_all = "snake_case")]
pub enum LoginKind {
    Email,
    Cloud,
}

impl ToSql<Text, Backend> for LoginKind {
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Backend>) -> diesel::serialize::Result {
        let value = match self {
            LoginKind::Email => "email",
            LoginKind::Cloud => "cloud",
        };

        <str as ToSql<Text, Backend>>::to_sql(value, out)
    }
}

impl FromSql<Text, Backend> for LoginKind {
    fn from_sql(mut value: BackendValue) -> diesel::deserialize::Result<Self> {
        match read_value_bytes(&mut value) {
            b"email" => Ok(LoginKind::Email),
            b"cloud" => Ok(LoginKind::Cloud),
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
    pub key: String,
    pub name: String,
    pub desc: Option<String>,
    pub created_at: NaiveDateTime,
}

#[derive(Queryable, Serialize)]
pub struct Locale {
    pub key: String,
    pub name: String,
    pub disabled: bool,
}

#[derive(Queryable, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Model {
    pub id: i32,
    pub namespace: Option<String>,
    pub key: String,
    pub name: String,
    pub desc: Option<String>,
    pub created_at: NaiveDateTime,
}

#[derive(Queryable, Serialize)]
pub struct Field {
    pub id: i32,
    pub key: String,
    pub name: String,
    pub kind: String,
}

#[derive(Queryable, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelField {
    pub id: i32,
    pub field_id: i32,
    pub model_id: i32,
    pub key: String,
    pub name: String,
    pub desc: Option<String>,
    pub localized: bool,
    pub multiple: bool,
    pub required: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, AsExpression, FromSqlRow)]
#[diesel(sql_type = Text)]
#[serde(rename_all = "snake_case")]
pub enum ContentStage {
    Published,
    Draft,
}

impl ToSql<Text, Backend> for ContentStage {
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Backend>) -> diesel::serialize::Result {
        let value = match self {
            ContentStage::Published => "published",
            ContentStage::Draft => "draft",
        };

        <str as ToSql<Text, Backend>>::to_sql(value, out)
    }
}

impl FromSql<Text, Backend> for ContentStage {
    fn from_sql(mut value: BackendValue) -> diesel::deserialize::Result<Self> {
        match read_value_bytes(&mut value) {
            b"published" => Ok(ContentStage::Published),
            b"draft" => Ok(ContentStage::Draft),
            _ => Err("Unrecognized enum variant".into()),
        }
    }
}

#[derive(Queryable, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentValue {
    pub id: i32,
    pub content_id: i32,
    pub model_field_id: i32,
    pub locale: Option<String>,
    pub value: String,
}

#[derive(Queryable, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Content {
    pub id: i32,
    pub model_id: i32,
    pub name: String,
    pub stage: ContentStage,
    pub created_by: Option<i32>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Queryable)]
pub struct Permission {
    pub id: i32,
    pub user_id: Option<i32>,
    pub role_id: Option<i32>,
    pub key: String,
    pub created_at: NaiveDateTime,
}

#[derive(Queryable, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Page {
    pub id: i32,
    pub namespace: Option<String>,
    pub key: String,
    pub name: String,
    pub desc: Option<String>,
    pub path: String,
    pub template: String,
    pub locale: Option<String>,
    pub created_at: NaiveDateTime,
}

#[derive(Queryable, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Theme {
    pub id: String,
    pub version: String,
    pub name: String,
    pub created_at: NaiveDateTime,
}

#[derive(Queryable, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Asset {
    pub id: i32,
    pub name: String,
    pub filename: String,
    pub filetype: Option<String>,
    pub created_by: Option<i32>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}
