use std::sync::Arc;

use base64::prelude::{Engine, BASE64_STANDARD};
use jsonwebtoken::{errors::Error as JWTError, DecodingKey, EncodingKey, Header, Validation};
use ring::hmac;
use serde::{de::DeserializeOwned, Serialize};

#[derive(Clone)]
pub struct Crypto(Arc<Inner>);

impl Crypto {
    pub fn new(secret: &str) -> Self {
        Self(Arc::new(Inner {
            encoding_key: EncodingKey::from_secret(secret.as_bytes()),
            decoding_key: DecodingKey::from_secret(secret.as_bytes()),
            header: Header::default(),
            validation: Validation::new(jsonwebtoken::Algorithm::HS256),
            hmac512_key: hmac::Key::new(hmac::HMAC_SHA512, secret.as_bytes()),
        }))
    }

    pub fn encode<T: Serialize>(&self, claims: &T) -> Result<String, JWTError> {
        jsonwebtoken::encode(&self.0.header, claims, &self.0.encoding_key)
    }

    pub fn decode<T: DeserializeOwned>(&self, token: &str) -> Result<T, JWTError> {
        jsonwebtoken::decode::<T>(token, &self.0.decoding_key, &self.0.validation).map(|t| t.claims)
    }

    pub fn sign512(&self, message: &[u8]) -> String {
        BASE64_STANDARD.encode(hmac::sign(&self.0.hmac512_key, message))
    }
}

struct Inner {
    encoding_key: EncodingKey,
    decoding_key: DecodingKey,
    header: Header,
    validation: Validation,
    hmac512_key: hmac::Key,
}
