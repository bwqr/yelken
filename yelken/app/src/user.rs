pub use store::{Resource as UserResource, Store as UserStore};

mod store {
    use std::{future::Future, pin::Pin, sync::Arc};

    use leptos::prelude::{GetValue, ReadSignal, RwSignal, Set, SetValue, StoredValue};
    use shared::user::User;

    pub trait Resource: Send + Sync + 'static {
        fn fetch_user(&self) -> Pin<Box<dyn Future<Output = Result<User, String>> + Send>>;
    }

    #[derive(Clone, Copy)]
    pub struct Store {
        user: RwSignal<User>,
        user_loading: StoredValue<bool>,
        resource: StoredValue<Arc<dyn Resource>>,
    }

    impl Store {
        pub fn new(user: User, resource: Arc<dyn Resource>) -> Self {
            Self {
                user: RwSignal::new(user),
                user_loading: StoredValue::new(false),
                resource: StoredValue::new(resource),
            }
        }

        pub fn user(&self) -> ReadSignal<User> {
            self.user.read_only()
        }

        pub async fn load_user(self) -> Result<(), String> {
            if self.user_loading.get_value() {
                return Ok(());
            }

            let Some(resource) = self.resource.try_get_value() else {
                log::error!("Content resource is deallocated");

                return Err("Resource not available".to_string());
            };

            self.user_loading.set_value(true);

            let user = resource.fetch_user().await;

            self.user_loading.set_value(false);

            self.user.set(user?);

            Ok(())
        }
    }
}
