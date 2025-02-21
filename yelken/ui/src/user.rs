use std::future::Future;
use leptos::prelude::{ReadSignal, RwSignal};
use shared::user::User;

pub struct UserStore {
    user: RwSignal<User>
}

impl UserStore {
    pub fn new(user: User) -> Self {
        Self { user: RwSignal::new(user) }
    }

    pub fn user(&self) -> ReadSignal<User> {
        self.user.read_only()
    }
}

pub trait UserAction: Send {
    fn fetch_user(&self) -> impl Future<Output = Result<User, String>> + Send;
}
