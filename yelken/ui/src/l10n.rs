use std::{collections::HashMap, ops::Deref, sync::Arc};

use fluent::{concurrent::FluentBundle, FluentArgs, FluentResource, FluentValue};
use unic_langid::LanguageIdentifier;

#[derive(Clone)]
pub struct L10n(Arc<Inner>);

impl L10n {
    pub fn new<'a>(
        supported_locales: Arc<[LanguageIdentifier]>,
        default: LanguageIdentifier,
        bundles: HashMap<LanguageIdentifier, FluentBundle<FluentResource>>,
    ) -> Self {
        Self(Arc::new(Inner {
            bundles,
            default,
            supported_locales,
        }))
    }
}

impl Deref for L10n {
    type Target = Inner;

    fn deref(&self) -> &Self::Target {
        &*self.0
    }
}

pub struct Inner {
    default: LanguageIdentifier,
    supported_locales: Arc<[LanguageIdentifier]>,
    bundles: HashMap<LanguageIdentifier, FluentBundle<FluentResource>>,
}

impl Inner {
    pub fn localize<'a>(
        &'a self,
        locale: &LanguageIdentifier,
        key: &'a str,
        args: impl Iterator<Item = (&'a str, &'a str)>,
    ) -> Option<String> {
        let bundle = self
            .bundles
            .get(locale)
            .or_else(|| self.bundles.get(&self.default))?;

        let msg = bundle.get_message(key)?;

        let pattern = msg.value()?;

        let mut fluent_args = FluentArgs::new();

        args.for_each(|(key, val)| fluent_args.set(key, FluentValue::from(val)));

        let mut errors = vec![];

        Some(
            bundle
                .format_pattern(pattern, Some(&fluent_args), &mut errors)
                .into_owned(),
        )
    }

    pub fn supported_locales(&self) -> Arc<[LanguageIdentifier]> {
        self.supported_locales.clone()
    }

    pub fn default_locale(&self) -> &LanguageIdentifier {
        &self.default
    }
}
