use std::{collections::HashMap, ops::Deref};

use axum::{
    extract::{FromRequest, Request},
    Json,
};
use serde::{de::DeserializeOwned, Serialize};

use crate::{responses::HttpError, sanitize::Sanitized};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Errors {
    pub field_messages: HashMap<&'static str, Vec<&'static str>>,
    pub messages: Vec<&'static str>,
}

impl Errors {
    pub fn new() -> Self {
        Self {
            field_messages: HashMap::new(),
            messages: Vec::new(),
        }
    }

    pub fn is_empty(&self) -> bool {
        self.field_messages.len() == 0 && self.messages.len() == 0
    }

    pub fn insert_field(&mut self, key: &'static str, error: &'static str) {
        self.field_messages.entry(key).or_insert(vec![]).push(error)
    }
}

pub trait Validate {
    fn validate(&self) -> Result<(), Errors>;
}

impl<T> Validate for Sanitized<T>
where
    T: Validate,
{
    fn validate(&self) -> Result<(), Errors> {
        self.0.validate()
    }
}

pub struct Validated<T>(pub T);

impl<T> Deref for Validated<T> {
    type Target = T;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl<S, T> FromRequest<S> for Validated<T>
where
    S: Send + Sync,
    T: FromRequest<S> + Validate,
{
    type Rejection = Result<HttpError, T::Rejection>;

    async fn from_request(req: Request, state: &S) -> Result<Self, Self::Rejection> {
        let inner = <T as FromRequest<S>>::from_request(req, state)
            .await
            .map_err(|e| Err(e))?;

        if let Err(e) = inner.validate() {
            return Err(Ok(HttpError::validation_errors(e)));
        }

        Ok(Validated(inner))
    }
}

impl<T> Validate for Json<T>
where
    T: DeserializeOwned + Validate,
{
    fn validate(&self) -> Result<(), Errors> {
        self.0.validate()
    }
}
