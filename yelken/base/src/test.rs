use diesel_async::{
    pooled_connection::AsyncDieselConnectionManager, AsyncConnection, AsyncPgConnection,
};

use crate::types::Pool;

pub async fn create_pool(conn_str: &str) -> Pool {
    let manager = AsyncDieselConnectionManager::<AsyncPgConnection>::new(conn_str);

    let pool: Pool = Pool::builder().build(manager).await.unwrap();

    pool.get()
        .await
        .unwrap()
        .begin_test_transaction()
        .await
        .unwrap();

    pool
}
