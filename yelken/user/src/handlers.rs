use axum::Json;
use base::models::{AuthUser, HttpError};
use shared::user::User;

pub async fn fetch_profile(user: AuthUser) -> Result<Json<User>, HttpError> {
    Ok(Json(User {
        id: user.id,
        name: user.name,
    }))
}
