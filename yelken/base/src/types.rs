use diesel_async::{
    pooled_connection::bb8::{self, PooledConnection},
    AsyncPgConnection,
};

pub type Pool = bb8::Pool<AsyncPgConnection>;
pub type Connection<'a> = PooledConnection<'a, AsyncPgConnection>;
