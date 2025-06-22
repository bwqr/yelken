use serde::{Deserialize, Serialize};

use crate::services::SafePath;

pub enum ResourceKind {
    Locale,
    Template,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(tag = "kind")]
#[serde(rename_all = "snake_case")]
pub enum LocationKind {
    Global,
    Theme { namespace: SafePath<1> },
    User { namespace: SafePath<1> },
}

pub fn location(location: &LocationKind, resource: ResourceKind) -> String {
    let dir = match resource {
        ResourceKind::Locale => "locales",
        ResourceKind::Template => "templates",
    };

    match location {
        LocationKind::Global => format!("{dir}/global"),
        LocationKind::Theme { namespace } => format!("themes/{}/{dir}", namespace.0),
        LocationKind::User { namespace } => format!("{dir}/themes/{}", namespace.0),
    }
}
