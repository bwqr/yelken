use leptos::prelude::*;
use leptos_router::{
    components::{Outlet, ParentRoute, Route},
    path, MatchNestedRoutes,
};

pub use store::Resource as ContentResource;
pub use store::Store as ContentStore;

mod content;
mod model;

mod store {
    use leptos::prelude::{GetValue, ReadSignal, RwSignal, Set, SetValue, StoredValue, Update};
    use shared::content::{CreateModel, Field, Model};
    use std::{future::Future, pin::Pin, sync::Arc};

    use crate::BaseResource;

    pub trait Resource: Send + Sync + 'static {
        fn fetch_models(
            &self,
        ) -> Pin<Box<dyn Future<Output = Result<Arc<[Model]>, String>> + Send>>;

        fn fetch_fields(
            &self,
        ) -> Pin<Box<dyn Future<Output = Result<Arc<[Field]>, String>> + Send>>;
    }

    #[derive(Copy, Clone)]
    pub struct Store {
        fields: RwSignal<Arc<[Field]>>,
        fields_loading: StoredValue<bool>,
        models: RwSignal<Arc<[Model]>>,
        models_loading: StoredValue<bool>,
        base: StoredValue<BaseResource>,
        resource: StoredValue<Arc<dyn Resource>>,
    }

    impl Store {
        pub fn new(base: BaseResource, resource: Arc<dyn Resource>) -> Self {
            Self {
                fields: RwSignal::new(Arc::new([])),
                fields_loading: StoredValue::new(false),
                models: RwSignal::new(Arc::new([])),
                models_loading: StoredValue::new(false),
                base: StoredValue::new(base),
                resource: StoredValue::new(resource),
            }
        }

        pub fn models(&self) -> ReadSignal<Arc<[Model]>> {
            self.models.read_only()
        }

        pub fn fields(&self) -> ReadSignal<Arc<[Field]>> {
            self.fields.read_only()
        }

        pub async fn load_fields(self) -> Result<(), String> {
            if self.models_loading.get_value() {
                return Ok(());
            }

            let Some(resource) = self.resource.try_get_value() else {
                log::error!("Content resource is deallocated");

                return Err("Resource not available".to_string());
            };

            self.models_loading.set_value(true);

            let models = resource.fetch_models().await;

            self.models_loading.set_value(false);

            self.models.set(models?);

            Ok(())
        }

        pub async fn load_models(self) -> Result<(), String> {
            if self.fields_loading.get_value() {
                return Ok(());
            }

            let Some(resource) = self.resource.try_get_value() else {
                log::error!("Content resource is deallocated");

                return Err("Resource not available".to_string());
            };

            self.fields_loading.set_value(true);

            let fields = resource.fetch_fields().await;

            self.fields_loading.set_value(false);

            self.fields.set(fields?);

            Ok(())
        }

        pub async fn create_model(self, req: CreateModel) -> Result<(), String> {
            let model = self
                .base
                .get_value()
                .post::<_, shared::content::Model>("/api/content/model", req)
                .await?;

            self.models.update(|models| {
                let mut v = Vec::from_iter(models.into_iter().map(|m| m.clone()));

                v.push(model);

                *models = v.into();
            });

            Ok(())
        }
    }
}

#[component(transparent)]
pub fn ContentRoutes() -> impl MatchNestedRoutes + Clone {
    view! {
        <ParentRoute path=path!("content") view=Outlet>
            <Route path=path!("models") view=model::Models/>
            <Route path=path!("create-model") view=model::CreateModel/>
            <Route path=path!("model/:namespace/:name") view=model::Model/>
            <Route path=path!("model/:name") view=model::Model/>

            <Route path=path!("contents") view=content::Contents/>
        </ParentRoute>
    }
    .into_inner()
}
