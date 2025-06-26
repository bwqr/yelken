use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Options {
    pub theme: String,
    pub default_locale: String,
}
