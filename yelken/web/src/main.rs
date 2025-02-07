use ui::SimpleCounter;

mod log;

#[cfg(all(feature = "hydrate", feature = "csr"))]
compile_error!("feature \"hydrate\" and feature \"csr\" cannot be enabled at the same time");

fn main() {
    log::init();

    console_error_panic_hook::set_once();

    let entry = || SimpleCounter(ui::SimpleCounterProps { initial_value: 0 });

    #[cfg(feature = "hydrate")]
    leptos::mount::hydrate_body(entry);
    #[cfg(feature = "csr")]
    leptos::mount::mount_to_body(entry);
}
