use std::ops::Deref;

use axum::{
    extract::{FromRequest, Request},
    Json,
};
use serde::de::DeserializeOwned;

pub trait Sanitize {
    fn sanitize(self) -> Self;
}

pub struct Sanitized<T>(pub T);

impl<S, T> FromRequest<S> for Sanitized<T>
where
    S: Send + Sync,
    T: FromRequest<S> + Sanitize,
{
    type Rejection = T::Rejection;

    async fn from_request(req: Request, state: &S) -> Result<Self, Self::Rejection> {
        let inner = <T as FromRequest<S>>::from_request(req, state).await?;

        Ok(Sanitized(inner.sanitize()))
    }
}

impl<T> Deref for Sanitized<T> {
    type Target = T;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl<T> Sanitize for Json<T>
where
    T: DeserializeOwned + Sanitize,
{
    fn sanitize(self) -> Self {
        Json(self.0.sanitize())
    }
}

impl Sanitize for String {
    fn sanitize(self) -> Self {
        askama_escape::escape(self.trim(), askama_escape::Html).to_string()
    }
}

impl<T> Sanitize for Option<T>
where
    T: Sanitize,
{
    fn sanitize(self) -> Self {
        if let Some(t) = self {
            Some(t.sanitize())
        } else {
            None
        }
    }
}

impl<T> Sanitize for Vec<T>
where
    T: Sanitize,
{
    fn sanitize(self) -> Self {
        self.into_iter().map(Sanitize::sanitize).collect()
    }
}

impl Sanitize for i32 {
    fn sanitize(self) -> Self {
        self
    }
}

impl Sanitize for bool {
    fn sanitize(self) -> Self {
        self
    }
}
