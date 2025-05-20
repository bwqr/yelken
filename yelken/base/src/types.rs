use diesel_async::{pooled_connection::deadpool::{self, Object}, AsyncConnection};

#[cfg(feature = "sqlite")]
pub type Connection = crate::async_sqlite::AsyncSqliteConnection;
#[cfg(feature = "sqlite")]
pub type SyncConnection = diesel::SqliteConnection;

#[cfg(feature = "postgres")]
pub type Connection = diesel_async::AsyncPgConnection;
#[cfg(feature = "postgres")]
pub type SyncConnection = diesel::PgConnection;

pub type Backend = <Connection as AsyncConnection>::Backend;
pub type BackendValue<'a> = <Backend as diesel::backend::Backend>::RawValue<'a>;
pub type Pool = deadpool::Pool<Connection>;
pub type PooledConnection = Object<Connection>;
