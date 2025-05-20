use std::{collections::HashMap, sync::Arc};

use anyhow::{anyhow, Result};
use arc_swap::ArcSwap;
use base::IntoSendFuture;
use fluent::{concurrent::FluentBundle, FluentArgs, FluentResource, FluentValue};
use opendal::Operator;
use unic_langid::LanguageIdentifier;

async fn load_resource(storage: &Operator, path: &str) -> Result<FluentResource> {
    let ftl = storage
        .read(&path)
        .into_send_future()
        .await
        .map(|buf| std::str::from_utf8(&*buf.to_bytes()).map(|s| s.to_string()))??;

    FluentResource::try_new(ftl).map_err(|e| anyhow!("{e:?}"))
}

async fn load_locale(
    storage: &Operator,
    locations: &[String],
    locale: LanguageIdentifier,
    default: LanguageIdentifier,
) -> FluentBundle<FluentResource> {
    let mut bundle = FluentBundle::new_concurrent(vec![locale.clone(), default]);

    for location in locations {
        let path = format!("{}/{}.ftl", location, locale);

        log::debug!("Loading fluent resource file {path}");

        match load_resource(storage, &path).await {
            Ok(resource) => bundle.add_resource_overriding(resource),
            Err(e) => {
                log::debug!("Failed loading fluent resource, {e}");
            }
        };
    }

    bundle
}

#[derive(Clone)]
pub struct L10n(Arc<ArcSwap<Inner>>);

impl L10n {
    pub async fn reload(
        &self,
        storage: &Operator,
        locations: &[String],
        locales: &[LanguageIdentifier],
        default: LanguageIdentifier,
    ) {
        self.0.store(Arc::new(
            Inner::new(storage, locations, locales, default).await,
        ))
    }

    pub async fn new(
        storage: &Operator,
        locations: &[String],
        locales: &[LanguageIdentifier],
        default: LanguageIdentifier,
    ) -> L10n {
        Self(Arc::new(ArcSwap::new(Arc::new(
            Inner::new(storage, locations, locales, default).await,
        ))))
    }

    pub fn localize<'a>(
        &'a self,
        locale: &LanguageIdentifier,
        key: &'a str,
        args: impl Iterator<Item = (&'a str, &'a str)>,
    ) -> Option<String> {
        let inner = self.0.load();
        let bundle = inner.bundles.get(locale)?;

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
}

struct Inner {
    bundles: HashMap<LanguageIdentifier, FluentBundle<FluentResource>>,
}

impl Inner {
    async fn new(
        storage: &Operator,
        locations: &[String],
        locales: &[LanguageIdentifier],
        default: LanguageIdentifier,
    ) -> Self {
        let mut bundles = HashMap::new();

        for locale in locales {
            bundles.insert(
                locale.clone(),
                load_locale(&storage, locations, locale.clone(), default.clone()).await,
            );
        }

        Inner { bundles }
    }
}
