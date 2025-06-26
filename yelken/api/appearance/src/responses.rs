use base::utils::LocationKind;
use serde::Serialize;

#[derive(Serialize)]
pub struct Template {
    pub path: String,
    pub location: LocationKind,
}

#[derive(Serialize)]
pub struct TemplateDetail {
    pub path: String,
    pub template: String,
}
