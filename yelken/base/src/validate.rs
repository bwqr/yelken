use std::{collections::HashMap, ops::Deref};

use axum::{
    extract::{FromRequest, Request},
    Json,
};
use serde::{de::DeserializeOwned, Serialize};

use crate::{responses::HttpError, sanitize::Sanitized};

#[derive(Serialize)]
#[serde(untagged)]
pub enum Error {
    Field(Vec<&'static str>),
    Struct(HashMap<&'static str, Error>),
    List(HashMap<usize, Error>),
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Errors {
    pub field_messages: HashMap<&'static str, Error>,
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
        match self
            .field_messages
            .entry(key)
            .or_insert(Error::Field(vec![]))
        {
            Error::Field(v) => v.push(error),
            _ => log::warn!("cannot insert a field error into non field variant"),
        }
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

pub struct Valid<T>(pub T);

impl<T> Deref for Valid<T> {
    type Target = T;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl<S, T> FromRequest<S> for Valid<T>
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

        Ok(Valid(inner))
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
