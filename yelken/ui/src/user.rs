use leptos::prelude::ReadSignal;

#[derive(Clone)]
pub struct User {
    pub id: i32,
    pub name: String,
}

pub trait UserStore: Sync + Send {
    fn user(&self) -> ReadSignal<Option<User>>;
}
