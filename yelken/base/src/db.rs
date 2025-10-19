use diesel_async::{
    pooled_connection::deadpool::{self, Object},
    AsyncConnection, AsyncConnectionCore,
};

#[cfg(all(not(feature = "sqlite"), not(feature = "postgres")))]
compile_error!("Either \"sqlite\" or \"postgres\" feature needs to be enabled");

#[cfg(feature = "sqlite")]
pub use sqlite::{Connection, SyncConnection};

#[cfg(feature = "postgres")]
pub use postgres::{Connection, SyncConnection};

pub type Backend = <Connection as AsyncConnectionCore>::Backend;
pub type BackendValue<'a> = <Backend as diesel::backend::Backend>::RawValue<'a>;
pub type Pool = deadpool::Pool<Connection>;
pub type PooledConnection = Object<Connection>;

pub trait BatchQuery<Conn: AsyncConnection> {
    type Output;

    fn batched(self) -> Self::Output;
}

#[cfg(feature = "postgres")]
mod postgres {
    use diesel::{
        query_builder::{BatchInsert, InsertStatement},
        QuerySource,
    };

    use super::BatchQuery;

    pub type Connection = diesel_async::AsyncPgConnection;
    pub type SyncConnection = diesel::PgConnection;

    impl<Tab, Val, Op, QId, const STATIC_QUERY_ID: bool> BatchQuery<diesel_async::AsyncPgConnection>
        for InsertStatement<Tab, BatchInsert<Val, Tab, QId, STATIC_QUERY_ID>, Op>
    where
        Tab: QuerySource,
    {
        type Output = Self;

        fn batched(self) -> Self::Output {
            self
        }
    }
}

#[cfg(feature = "sqlite")]
mod sqlite {
    use diesel::{
        query_builder::{BatchInsert, InsertStatement},
        QueryResult, QuerySource,
    };
    use diesel_async::sync_connection_wrapper::SpawnBlocking;
    use futures::{future::BoxFuture, stream::BoxStream};
    use futures_util::StreamExt;

    use super::BatchQuery;

    pub type Connection = diesel_async::sync_connection_wrapper::SyncConnectionWrapper<
        diesel::sqlite::SqliteConnection,
        NoopSpawnBlocking,
    >;
    pub type SyncConnection = diesel::SqliteConnection;

    pub struct NoopSpawnBlocking;

    impl SpawnBlocking for NoopSpawnBlocking {
        fn spawn_blocking<'a, R>(
            &mut self,
            task: impl FnOnce() -> R + Send + 'static,
        ) -> BoxFuture<'a, Result<R, Box<dyn std::error::Error + Send + Sync + 'static>>>
        where
            R: Send + 'static,
        {
            Box::pin(async move { Ok(task()) })
        }

        fn get_runtime() -> Self {
            NoopSpawnBlocking
        }
    }

    pub struct SqliteBatchInsertWrapper<T>(T);

    impl<Tab, Val, Op, QId, const STATIC_QUERY_ID: bool> BatchQuery<super::Connection>
        for InsertStatement<Tab, BatchInsert<Val, Tab, QId, STATIC_QUERY_ID>, Op>
    where
        Tab: QuerySource,
    {
        type Output = SqliteBatchInsertWrapper<Self>;

        fn batched(self) -> Self::Output {
            SqliteBatchInsertWrapper(self)
        }
    }

    impl<T> diesel_async::methods::ExecuteDsl<super::Connection> for SqliteBatchInsertWrapper<T>
    where
        T: diesel::query_dsl::methods::ExecuteDsl<super::SyncConnection> + Send + 'static,
    {
        fn execute<'conn, 'query>(
            query: Self,
            conn: &'conn mut super::Connection,
        ) -> <super::Connection as super::AsyncConnection>::ExecuteFuture<'conn, 'query>
        where
            SqliteBatchInsertWrapper<T>: 'query,
        {
            conn.spawn_blocking(|conn| <_ as diesel::query_dsl::methods::ExecuteDsl<diesel::sqlite::SqliteConnection>>::execute(query.0, conn))
        }
    }

    impl<'query, T, U> diesel_async::methods::LoadQuery<'query, super::Connection, U>
        for SqliteBatchInsertWrapper<T>
    where
        U: Send + 'static,
        T: diesel::query_dsl::methods::LoadQuery<'query, super::SyncConnection, U> + Send + 'static,
    {
        type LoadFuture<'conn> = BoxFuture<'conn, QueryResult<Self::Stream<'conn>>>;

        type Stream<'conn> = BoxStream<'static, QueryResult<U>>;

        fn internal_load(
            self,
            conn: &mut super::Connection,
        ) -> <Self as diesel_async::methods::LoadQuery<'query, super::Connection, U>>::LoadFuture<'_>
        {
            conn.spawn_blocking(move |conn| {
                let val = <_ as diesel::query_dsl::methods::LoadQuery<
                    'query,
                    super::SyncConnection,
                    U,
                >>::internal_load(self.0, conn)?
                .collect::<Vec<_>>();

                Ok(futures::stream::iter(val.into_iter()).boxed())
            })
        }
    }
}
