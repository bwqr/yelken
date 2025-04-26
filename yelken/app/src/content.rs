use std::{future::Future, pin::Pin, sync::Arc};

use leptos::prelude::*;
use shared::content::{Field, Model};

#[derive(Clone, Copy)]
pub struct ContentStore {
    // fields: RwSignal<Arc<[Field]>>,
}

impl ContentStore {
    pub fn new(_: Arc<[Field]>) -> Self {
        Self {
            // fields: RwSignal::new(fields),
        }
    }
}

pub trait ContentResource: Send + Sync + 'static {
    fn fetch_models(&self) -> Pin<Box<dyn Future<Output = Result<Arc<[Model]>, String>> + Send>>;

    fn fetch_fields(&self) -> Pin<Box<dyn Future<Output = Result<Arc<[Field]>, String>> + Send>>;
}

#[component]
pub fn Models() -> impl IntoView {
    let content_resource = expect_context::<Arc<dyn ContentResource>>();

    let models = OnceResource::new(content_resource.fetch_models());

    view! {
        <div class="p-2">
            <p>"Models"</p>
            <Suspense fallback=|| "">
                {move || Suspend::new(async move {
                    let models = match models.await {
                        Ok(models) => models,
                        Err(_) => vec![].into(),
                    };

                    models.iter().map(|model| view! { <p>{model.name.clone()}</p> }).collect_view()
                })}
            </Suspense>
        </div>
    }
}
