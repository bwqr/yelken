use rand::{distr::Alphanumeric, rng, Rng};

#[cfg(feature = "email")]
pub mod email;

#[cfg(feature = "oauth")]
pub mod oauth;

fn generate_username(name: &str) -> String {
    name.chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .collect::<String>()
        + "_"
        + (0..12)
            .map(|_| rng().sample(Alphanumeric) as char)
            .collect::<String>()
            .as_str()
}
