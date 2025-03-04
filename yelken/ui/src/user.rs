use leptos::prelude::{ReadSignal, RwSignal};
use shared::user::User;
use std::{future::Future, pin::Pin};

#[derive(Clone, Copy)]
pub struct UserStore {
    user: RwSignal<User>,
}

impl UserStore {
    pub fn new(user: User) -> Self {
        Self {
            user: RwSignal::new(user),
        }
    }

    pub fn user(&self) -> ReadSignal<User> {
        self.user.read_only()
    }
}

pub trait UserResource: Send + Sync + 'static {
    fn fetch_user(&self) -> Pin<Box<dyn Future<Output = Result<User, String>> + Send>>;
}
