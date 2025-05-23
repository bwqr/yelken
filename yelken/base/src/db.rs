use diesel_async::{
    pooled_connection::deadpool::{self, Object},
    AsyncConnection,
};

#[cfg(all(not(feature = "sqlite"), not(feature = "postgres")))]
compile_error!("Either \"sqlite\" or \"postgres\" feature needs to be enabled");

#[cfg(feature = "sqlite")]
pub type Connection = AsyncSqliteConnection;
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

#[cfg(feature = "sqlite")]
pub use async_sqlite::AsyncSqliteConnection;

pub use helpers::BatchQuery;

mod helpers {
    use diesel::{
        query_builder::{BatchInsert, InsertStatement},
        QuerySource,
    };
    use diesel_async::{methods::ExecuteDsl, AsyncConnection};

    #[cfg(feature = "sqlite")]
    pub struct SqliteBatchInsertWrapper<T>(T);

    #[cfg(feature = "sqlite")]
    impl<T> ExecuteDsl<super::AsyncSqliteConnection> for SqliteBatchInsertWrapper<T>
    where
        T: diesel::query_dsl::methods::ExecuteDsl<diesel::sqlite::SqliteConnection>,
    {
        fn execute<'conn, 'query>(
            query: Self,
            conn: &'conn mut super::AsyncSqliteConnection,
        ) -> <super::AsyncSqliteConnection as super::AsyncConnection>::ExecuteFuture<'conn, 'query> where T: 'query {
            let ret = <_ as diesel::query_dsl::methods::ExecuteDsl<diesel::sqlite::SqliteConnection>>::execute(query.0, &mut conn.0);
            Box::pin(async move { ret })
        }
    }

    pub trait BatchQuery<Conn: AsyncConnection> {
        type Output: ExecuteDsl<Conn>;

        fn batched(self) -> Self::Output;
    }

    #[cfg(feature = "sqlite")]
    impl<Tab, Val, Op, QId, const STATIC_QUERY_ID: bool> BatchQuery<super::AsyncSqliteConnection>
        for InsertStatement<Tab, BatchInsert<Val, Tab, QId, STATIC_QUERY_ID>, Op>
    where
        Tab: QuerySource,
        Self: diesel::query_dsl::methods::ExecuteDsl<diesel::sqlite::SqliteConnection>,
    {
        type Output = SqliteBatchInsertWrapper<Self>;

        fn batched(self) -> Self::Output {
            SqliteBatchInsertWrapper(self)
        }
    }

    #[cfg(feature = "postgres")]
    impl<Tab, Val, Op, QId, const STATIC_QUERY_ID: bool> BatchQuery<diesel_async::AsyncPgConnection>
        for InsertStatement<Tab, BatchInsert<Val, Tab, QId, STATIC_QUERY_ID>, Op>
    where
        Tab: QuerySource,
        Self: ExecuteDsl<diesel_async::AsyncPgConnection>,
    {
        type Output = Self;

        fn batched(self) -> Self::Output {
            self
        }
    }
}

#[cfg(feature = "sqlite")]
mod async_sqlite {
    use diesel::{
        backend::Backend,
        connection::{LoadConnection, SimpleConnection, WithMetadataLookup},
        query_builder::{
            CollectedQuery, MoveableBindCollector, QueryBuilder, QueryFragment, QueryId,
        },
        row::IntoOwnedRow,
        Connection, QueryResult, SqliteConnection,
    };
    use diesel_async::{
        pooled_connection::PoolableConnection, AsyncConnection, SimpleAsyncConnection,
        TransactionManager,
    };
    use futures::{future::BoxFuture, stream::BoxStream, StreamExt};
    use send_wrapper::SendWrapper;

    pub struct AsyncSqliteConnection(pub(crate) SqliteConnection);

    impl SimpleAsyncConnection for AsyncSqliteConnection {
        async fn batch_execute(&mut self, query: &str) -> diesel::QueryResult<()> {
            self.0.batch_execute(query)
        }
    }

    impl AsyncConnection for AsyncSqliteConnection {
        type LoadFuture<'conn, 'query> =
            BoxFuture<'query, QueryResult<Self::Stream<'conn, 'query>>>;

        type ExecuteFuture<'conn, 'query> = BoxFuture<'query, QueryResult<usize>>;

        type Stream<'conn, 'query> = BoxStream<'static, QueryResult<Self::Row<'conn, 'query>>>;

        type Row<'conn, 'query> =
            <<SqliteConnection as LoadConnection>::Row<'conn, 'query> as IntoOwnedRow<
                'conn,
                <SqliteConnection as Connection>::Backend,
            >>::OwnedRow;

        type Backend = <SqliteConnection as Connection>::Backend;

        type TransactionManager = AsyncSqliteTransactionManager;

        async fn establish(database_url: &str) -> diesel::ConnectionResult<Self> {
            SqliteConnection::establish(database_url).map(|sc| Self(sc))
        }

        fn load<'conn, 'query, T>(&'conn mut self, source: T) -> Self::LoadFuture<'conn, 'query>
        where
            T: diesel::query_builder::AsQuery + 'query,
            T::Query: diesel::query_builder::QueryFragment<Self::Backend>
                + diesel::query_builder::QueryId
                + 'query,
        {
            let rows = self.execute_with_prepared_query(source.as_query(), |conn, query| {
                use diesel::row::IntoOwnedRow;
                let mut cache =
                    <<<SqliteConnection as LoadConnection>::Row<'_, '_> as IntoOwnedRow<
                        <SqliteConnection as Connection>::Backend,
                    >>::Cache as Default>::default();
                let cursor = conn.load(&query)?;

                let size_hint = cursor.size_hint();
                let mut out = Vec::with_capacity(size_hint.1.unwrap_or(size_hint.0));
                // we use an explicit loop here to easily propagate possible errors
                // as early as possible
                for row in cursor {
                    out.push(Ok(IntoOwnedRow::into_owned(row?, &mut cache)));
                }

                Ok(out)
            });

            Box::pin(SendWrapper::new(async move {
                Ok(SendWrapper::new(futures_util::stream::iter(rows?)).boxed())
            }))
        }

        fn execute_returning_count<'conn, 'query, T>(
            &'conn mut self,
            source: T,
        ) -> Self::ExecuteFuture<'conn, 'query>
        where
            T: diesel::query_builder::QueryFragment<Self::Backend>
                + diesel::query_builder::QueryId
                + 'query,
        {
            let rows = self.execute_with_prepared_query(source, |conn, query| {
                conn.execute_returning_count(&query)
            });

            Box::pin(async move { rows })
        }

        fn transaction_state(
            &mut self,
        ) -> &mut <Self::TransactionManager as diesel_async::TransactionManager<Self>>::TransactionStateData{
            self.0.transaction_state()
        }

        fn instrumentation(&mut self) -> &mut dyn diesel::connection::Instrumentation {
            self.0.instrumentation()
        }

        fn set_instrumentation(
            &mut self,
            instrumentation: impl diesel::connection::Instrumentation,
        ) {
            self.0.set_instrumentation(instrumentation);
        }

        fn set_prepared_statement_cache_size(&mut self, size: diesel::connection::CacheSize) {
            self.0.set_prepared_statement_cache_size(size);
        }
    }

    pub struct AsyncSqliteTransactionManager;

    impl TransactionManager<AsyncSqliteConnection> for AsyncSqliteTransactionManager {
        type TransactionStateData = <<SqliteConnection as Connection>::TransactionManager as diesel::connection::TransactionManager<SqliteConnection>>::TransactionStateData;

        async fn begin_transaction(conn: &mut AsyncSqliteConnection) -> QueryResult<()> {
            <<SqliteConnection as Connection>::TransactionManager as diesel::connection::TransactionManager<SqliteConnection>>::begin_transaction(&mut conn.0)
        }

        async fn rollback_transaction(conn: &mut AsyncSqliteConnection) -> QueryResult<()> {
            <<SqliteConnection as Connection>::TransactionManager as diesel::connection::TransactionManager<SqliteConnection>>::rollback_transaction(&mut conn.0)
        }

        async fn commit_transaction(conn: &mut AsyncSqliteConnection) -> QueryResult<()> {
            <<SqliteConnection as Connection>::TransactionManager as diesel::connection::TransactionManager<SqliteConnection>>::commit_transaction(&mut conn.0)
        }

        fn transaction_manager_status_mut(
            conn: &mut AsyncSqliteConnection,
        ) -> &mut diesel::connection::TransactionManagerStatus {
            <<SqliteConnection as Connection>::TransactionManager as diesel::connection::TransactionManager<SqliteConnection>>::transaction_manager_status_mut(&mut conn.0)
        }
    }

    impl AsyncSqliteConnection {
        fn execute_with_prepared_query<'a, MD, Q, R>(
            &'a mut self,
            query: Q,
            callback: impl FnOnce(&mut SqliteConnection, &CollectedQuery<MD>) -> QueryResult<R>
                + Send
                + 'a,
        ) -> QueryResult<R>
        where
            // BindCollector bounds
            MD: Send + 'static,
            for<'b> <<SqliteConnection as Connection>::Backend as Backend>::BindCollector<'b>:
                MoveableBindCollector<<SqliteConnection as Connection>::Backend, BindData = MD>
                    + std::default::Default,
            // Arguments/Return bounds
            Q: QueryFragment<<SqliteConnection as Connection>::Backend> + QueryId,
        {
            let backend = <SqliteConnection as Connection>::Backend::default();

            let (collect_bind_result, collector_data) = {
                let mut bind_collector =
                <<<SqliteConnection as Connection>::Backend as Backend>::BindCollector<'_> as Default>::default();
                let metadata_lookup = self.0.metadata_lookup();
                let result = query.collect_binds(&mut bind_collector, metadata_lookup, &backend);
                let collector_data = bind_collector.moveable();

                (result, collector_data)
            };

            let mut query_builder = <<<SqliteConnection as Connection>::Backend as Backend>::QueryBuilder as Default>::default();

            let sql = query
                .to_sql(&mut query_builder, &backend)
                .map(|_| query_builder.finish());
            let is_safe_to_cache_prepared = query.is_safe_to_cache_prepared(&backend);

            collect_bind_result?;
            let query = CollectedQuery::new(sql?, is_safe_to_cache_prepared?, collector_data);
            callback(&mut self.0, &query)
        }
    }

    impl PoolableConnection for AsyncSqliteConnection
    where
        Self: AsyncConnection,
    {
        fn is_broken(&mut self) -> bool {
            Self::TransactionManager::is_broken_transaction_manager(self)
        }
    }
}
