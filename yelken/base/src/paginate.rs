use std::cmp::max;

use diesel::{
    expression::{is_aggregate::No, ValidGrouping},
    query_builder::{AstPass, Query, QueryFragment, QueryId},
    sql_types::BigInt,
    AppearsOnTable, Expression, QueryResult, SelectableExpression,
};
use diesel_async::{methods::LoadQuery, RunQueryDsl};
use serde::{Deserialize, Serialize};

use crate::db::{Backend, Connection, PooledConnection};

const DEFAULT_PER_PAGE: i64 = 20;

fn offset(page: i64, per_page: i64) -> i64 {
    max(page - 1, 0) * per_page
}

pub trait Paginate: Sized {
    fn paginate(self, page: Option<i64>) -> Paginated<Self>;
}

impl<T: QueryFragment<Backend>> Paginate for T {
    fn paginate(self, page: Option<i64>) -> Paginated<Self> {
        let page = match page {
            Some(num) => num,
            None => 1,
        };

        Paginated {
            query: self,
            page,
            per_page: DEFAULT_PER_PAGE,
            offset: offset(page, DEFAULT_PER_PAGE),
        }
    }
}

#[derive(Debug, Clone, Copy, QueryId)]
pub struct Paginated<T> {
    pub query: T,
    page: i64,
    per_page: i64,
    offset: i64,
}

impl<T> Paginated<T> {
    pub fn per_page(self, per_page: Option<i64>) -> Self {
        let per_page = match per_page {
            Some(num) => num,
            None => DEFAULT_PER_PAGE,
        };

        Paginated {
            offset: offset(self.page, per_page),
            per_page,
            ..self
        }
    }

    pub async fn load_and_count_pages<'query, U>(
        self,
        conn: &mut PooledConnection,
    ) -> QueryResult<Pagination<U>>
    where
        Self: LoadQuery<'query, Connection, (U, i64)> + 'query,
        U: Serialize + Send,
    {
        let per_page = self.per_page;
        let page = self.page;

        let results = self.load::<(U, i64)>(conn).await?;
        let total = results.get(0).map(|x| x.1).unwrap_or(0);
        let items = results.into_iter().map(|x| x.0).collect();
        let total_pages = (total as f64 / per_page as f64).ceil() as i64;

        Ok(Pagination {
            per_page,
            current_page: page,
            total_items: total,
            total_pages,
            items,
        })
    }
}

impl<T: Query> Query for Paginated<T> {
    type SqlType = T::SqlType;
}

impl<T> QueryFragment<Backend> for Paginated<T>
where
    T: QueryFragment<Backend>,
{
    fn walk_ast<'b>(&'b self, mut out: AstPass<'_, 'b, Backend>) -> QueryResult<()> {
        self.query.walk_ast(out.reborrow())?;

        out.push_sql(" LIMIT ");
        out.push_bind_param::<BigInt, _>(&self.per_page)?;
        out.push_sql(" OFFSET ");
        out.push_bind_param::<BigInt, _>(&self.offset)?;

        Ok(())
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Pagination<T> {
    per_page: i64,
    current_page: i64,
    total_pages: i64,
    total_items: i64,
    items: Vec<T>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaginationRequest {
    pub per_page: Option<i64>,
    pub page: Option<i64>,
}

pub struct CountStarOver;

impl Expression for CountStarOver {
    type SqlType = BigInt;
}

impl QueryFragment<Backend> for CountStarOver {
    fn walk_ast(&self, mut out: AstPass<Backend>) -> QueryResult<()> {
        out.push_sql("COUNT(*) OVER()");
        Ok(())
    }
}

impl<QS> AppearsOnTable<QS> for CountStarOver {}

impl<QS> SelectableExpression<QS> for CountStarOver {}

impl ValidGrouping<()> for CountStarOver {
    type IsAggregate = No;
}

impl QueryId for CountStarOver {
    type QueryId = <Self as Expression>::SqlType;
}
