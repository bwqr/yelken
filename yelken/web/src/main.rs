use std::sync::Arc;

use leptos::prelude::{ReadSignal, RwSignal};
use ui::user::{User, UserStore};
use ui::{Root, RootProps};

mod log;

#[cfg(all(feature = "hydrate", feature = "csr"))]
compile_error!("feature \"hydrate\" and feature \"csr\" cannot be enabled at the same time");

struct UserContext {
    user_signal: RwSignal<Option<User>>,
}

impl UserStore for UserContext {
    fn user(&self) -> ReadSignal<Option<User>> {
        self.user_signal.read_only()
    }
}

fn main() {
    log::init();

    console_error_panic_hook::set_once();

    let user_store: Arc<dyn UserStore> = Arc::new(UserContext {
        user_signal: RwSignal::new(None),
    });

    #[cfg(not(feature = "csr"))]
    leptos::mount::hydrate_body(|| {
        Root(RootProps {
            user_store,
            base: "/yk-app".to_string(),
        })
    });
    #[cfg(feature = "csr")]
    leptos::mount::mount_to_body(|| {
        Root(RootProps {
            user_store,
            base: "".to_string(),
        })
    });
}
