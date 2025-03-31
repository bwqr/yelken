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

#[derive(Clone, Debug, PartialEq, AsExpression, FromSqlRow)]
#[diesel(sql_type = Text)]
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

#[derive(Queryable)]
pub struct User {
    pub id: i32,
    pub role_id: Option<i32>,
    pub username: String,
    pub name: String,
    pub email: String,
    pub password: String,
    pub salt: String,
    pub state: UserState,
    pub created_at: NaiveDateTime,
}

#[derive(Queryable)]
pub struct Role {
    pub id: i32,
    pub name: String,
    pub created_at: NaiveDateTime,
}
