use crate::types::Connection;
use diesel_async::{pooled_connection::AsyncDieselConnectionManager, AsyncConnection};

use crate::types::Pool;

pub const DB_CONFIG: &'static str = if let Some(env) = option_env!("YELKEN_TEST_DATABASE_URL") {
    env
} else {
    "postgres://yelken:toor@127.0.0.1/yelken_test"
};

pub async fn create_pool(conn_str: &str) -> Pool {
    let manager = AsyncDieselConnectionManager::<Connection>::new(conn_str);

    let pool: Pool = Pool::builder(manager).build().unwrap();

    pool.get()
        .await
        .unwrap()
        .begin_test_transaction()
        .await
        .unwrap();

    pool
}
