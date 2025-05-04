use crate::responses::User;
use axum::Json;
use base::{middlewares::auth::AuthUser, responses::HttpError};

pub async fn fetch_profile(user: AuthUser) -> Result<Json<User>, HttpError> {
    Ok(Json(User {
        id: user.id,
        name: user.name,
    }))
}
