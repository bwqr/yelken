use diesel_async::pooled_connection::deadpool::{self, Object};

use crate::async_sqlite::AsyncSqliteConnection;

pub type Pool = deadpool::Pool<AsyncSqliteConnection>;
pub type Connection = Object<AsyncSqliteConnection>;
