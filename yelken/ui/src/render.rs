use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::sync::Arc;

use arc_swap::ArcSwap;
use base::responses::HttpError;
use base::schema::{content_values, contents, enum_options, fields, model_fields, models};
use base::types::Pool;
use context::{LocaleContext, PageContext};
use minijinja::value::Kwargs;
use minijinja::{Environment, Error, ErrorKind, State, Value};
use opendal::{EntryMode, Operator};
use unic_langid::LanguageIdentifier;

use crate::l10n::L10n;

pub mod context {
    use minijinja::value::{Object, Value};
    use std::{collections::BTreeMap, sync::Arc};
    use unic_langid::LanguageIdentifier;

    #[derive(Debug)]
    pub struct Page {
        pub name: String,
        pub locale: LanguageIdentifier,
        pub path: String,
    }

    #[derive(Debug)]
    pub struct PageContext {
        pub pages: Arc<[Page]>,
    }

    impl Object for PageContext {}

    #[derive(Debug)]
    pub struct LocaleContext {
        pub all: Arc<[LanguageIdentifier]>,
        pub current: LanguageIdentifier,
        pub default: LanguageIdentifier,
    }

    impl Object for LocaleContext {
        fn get_value(self: &Arc<Self>, key: &Value) -> Option<Value> {
            match key.as_str()? {
                "all" => Some(Value::from_iter(self.all.iter().map(|l| vec![format!("{l}"), format!("{l}")]))),
                "current" => Some(Value::from(format!("{}", self.current))),
                "default" => Some(Value::from(format!("{}", self.default))),
                _ => None,
            }
        }
    }

    #[derive(Debug)]
    pub struct RenderContext {
        locale: Arc<LocaleContext>,
        pages: Arc<PageContext>,
        params: Arc<BTreeMap<String, String>>,
    }

    impl RenderContext {
        pub fn new(
            locale: Arc<LocaleContext>,
            pages: Arc<PageContext>,
            params: Arc<BTreeMap<String, String>>,
        ) -> Self {
            Self {
                locale,
                pages,
                params,
            }
        }
    }

    impl Object for RenderContext {
        fn get_value(self: &Arc<Self>, key: &Value) -> Option<Value> {
            match key.as_str()? {
                "locale" => Some(Value::from_dyn_object(self.locale.clone())),
                "pages" => Some(Value::from_dyn_object(Arc::clone(&self.pages))),
                "params" => Some(Value::from_dyn_object(Arc::clone(&self.params))),
                _ => None,
            }
        }
    }
}

#[cfg(feature = "plugin")]
pub type FnResources = (L10n, Pool, plugin::PluginHost);
#[cfg(not(feature = "plugin"))]
pub type FnResources = (L10n, Pool);

async fn load_templates(storage: &Operator, locations: &[String]) -> Vec<(String, String)> {
    let mut templates = HashMap::<String, String>::new();

    // It is expected that the template that exists in later `location` should override
    // previously loaded ones. So, iteration is reversed.
    for location in locations.into_iter().rev() {
        let Ok(entries) = storage
            .list_with(location)
            .recursive(true)
            .await
            .inspect_err(|e| log::debug!("Failed to read directory {location:?} {e:?}"))
        else {
            continue;
        };

        for entry in entries {
            if entry.metadata().mode() != EntryMode::FILE || !entry.path().ends_with(".html") {
                continue;
            }

            let key = entry.path().strip_prefix(location).unwrap();

            if !templates.contains_key(key) {
                log::debug!("loading template file {}", entry.path());

                let Ok(bytes) = storage
                    .read(entry.path())
                    .await
                    .inspect_err(|e| log::warn!("Failed to read template {e}"))
                    .map(|b| b.to_bytes())
                else {
                    continue;
                };

                let Ok(template) = std::str::from_utf8(&*bytes)
                    .inspect_err(|e| log::warn!("Failed to read template as string {e:?}"))
                else {
                    continue;
                };

                templates.insert(key.to_string(), template.to_string());
            } else {
                log::debug!("skipping template file {}", entry.path());
            }
        }
    }

    templates.into_iter().collect()
}

#[derive(Clone)]
pub struct Render {
    env: Arc<ArcSwap<Environment<'static>>>,
    resources: Option<FnResources>,
}

impl Render {
    pub fn empty(resources: Option<FnResources>) -> Self {
        let mut env = Environment::new();

        if let Some(resources) = &resources {
            register_functions(&mut env, resources.clone());
        }

        Self {
            env: Arc::new(ArcSwap::new(Arc::new(env))),
            resources,
        }
    }

    pub async fn new(
        storage: &Operator,
        locations: &[String],
        resources: Option<FnResources>,
    ) -> Result<Self, Error> {
        let templates = load_templates(storage, locations).await;

        let mut env = Environment::new();

        for (name, template) in templates {
            env.add_template_owned(name, template)?;
        }

        if let Some(resources) = &resources {
            register_functions(&mut env, resources.clone());
        }

        Ok(Self {
            env: Arc::new(ArcSwap::new(Arc::new(env))),
            resources,
        })
    }

    pub async fn reload(&self, storage: &Operator, locations: &[String]) -> Result<(), Error> {
        let templates = load_templates(storage, locations).await;

        let mut env = Environment::new();

        for (name, template) in templates {
            env.add_template_owned(name, template)?;
        }

        if let Some(resources) = &self.resources {
            register_functions(&mut env, resources.clone());
        }

        self.env.store(Arc::new(env));

        Ok(())
    }

    pub fn render(&self, template: &str, ctx: Value) -> Result<String, Error> {
        (*self.env).load().get_template(template)?.render(ctx)
    }
}

fn register_functions(env: &mut Environment, resources: FnResources) {
    use diesel::prelude::*;
    use diesel_async::RunQueryDsl;

    #[cfg(feature = "plugin")]
    let (l10n, pool, plugin_host) = resources;
    #[cfg(not(feature = "plugin"))]
    let (l10n, pool) = resources;

    env.add_function(
        "localize",
        move |state: &State, key: String, kwargs: Kwargs| -> Option<String> {
            let locale: Arc<LocaleContext> = state
                .lookup("locale")
                .expect("could not find locale in render context")
                .downcast_object()
                .expect("locale variable does not have expected type");

            let args = kwargs.args().map(|arg| (arg, kwargs.get(arg).unwrap()));

            l10n.localize(&locale.current, &key, args)
        },
    );

    env.add_function("asset_url", |path: String, kwargs: Kwargs| {
        let kind = kwargs.get::<&str>("kind").unwrap_or("static");

        match kind {
            "static" | "content" => Ok(format!("/assets/{kind}/{path}")),
            unknown => Err(Error::new(
                ErrorKind::InvalidOperation,
                format!("unknown asset kind {unknown}"),
            )),
        }
    });

    env.add_function("localize_url", |state: &State, args: Kwargs| {
        let locale: Arc<LocaleContext> = state
            .lookup("locale")
            .expect("could not find locale in render context")
            .downcast_object()
            .expect("locale variable does not have expected type");

        if let Some(name) = args.get::<'_, Option<String>>("page")? {
            let page_context: Arc<PageContext> = state
                .lookup("pages")
                .expect("could not find pages in render context")
                .downcast_object()
                .expect("pages variable does not have expected type");

            let path_params: Vec<String> = args.get("params")?;

            for p in page_context.pages.into_iter() {
                if name != p.name || locale.current != p.locale {
                    continue;
                }

                let Some(path) = replace_params(&p.path, &path_params) else {
                    log::warn!("Invalid path or param is received while in localize_url, {}, {path_params:?}", p.path);

                    return Err(Error::new(
                        ErrorKind::InvalidOperation,
                        "invalid parameters",
                    ));
                };

                return Ok(Value::from(append_locale_to_path(&locale.current, &locale.default, &path)));
            }

            return Err(Error::new(
                ErrorKind::InvalidOperation,
                "page not found",
            ));
        } else if let Some(path) = args.get::<'_, Option<String>>("path")? {
            return Ok(Value::from(append_locale_to_path(&locale.current, &locale.default, &path)));
        }

        return Err(Error::new(
                ErrorKind::InvalidOperation,
                "invalid parameters",
            ));
    });

    {
        let pool = pool.clone();

        env.add_function("get_enum_id", move |field: String, value: String| {
            let pool = pool.clone();

            let id: Result<i32, HttpError> =
                tokio::runtime::Handle::current().block_on(async move {
                    Ok(enum_options::table
                        .inner_join(fields::table)
                        .filter(fields::name.eq(field))
                        .filter(enum_options::value.eq(value))
                        .select(enum_options::id)
                        .first::<i32>(&mut pool.get().await?)
                        .await?)
                });

            id.map(|id| Value::from(id))
                .map_err(|e| Error::new(ErrorKind::InvalidOperation, format!("{e:?}")))
        });
    }

    {
        let pool = pool.clone();

        env.add_function(
            "get_content",
            move |state: &State, model: String, field: String, value: String| {
                let locale: Arc<LocaleContext> = state
                    .lookup("locale")
                    .expect("could not find locale in render context")
                    .downcast_object()
                    .expect("locale variable does not have expected type");

                let pool = pool.clone();

                let content: Result<BTreeMap<String, Value>, HttpError> =
                    tokio::runtime::Handle::current().block_on(async move {
                        let mut conn = pool.get().await?;

                        let model_id = models::table
                            .filter(models::name.eq(model))
                            .select(models::id)
                            .first::<i32>(&mut conn)
                            .await?;

                        let model_fields = model_fields::table
                            .inner_join(fields::table)
                            .filter(model_fields::model_id.eq(model_id))
                            .select((
                                model_fields::id,
                                model_fields::name,
                                model_fields::multiple,
                                fields::kind,
                            ))
                            .load::<(i32, String, bool, String)>(&mut conn)
                            .await?;

                        let content = if field == "id" {
                            let id = str::parse::<i32>(&value).map_err(|_| {
                                HttpError::internal_server_error("invalid_arg_received")
                            })?;

                            contents::table
                                .select(contents::id)
                                .filter(contents::id.eq(id))
                                .first::<i32>(&mut conn)
                                .await?
                        } else {
                            let Some(model_field) = model_fields.iter().find(|mf| mf.1 == field)
                            else {
                                return Err(HttpError::internal_server_error(
                                    "unknown_field_received",
                                ));
                            };

                            contents::table
                                .select(contents::id)
                                .inner_join(content_values::table)
                                .filter(
                                    content_values::model_field_id
                                        .eq(model_field.0)
                                        .and(content_values::value.eq(value)),
                                )
                                .first::<i32>(&mut conn)
                                .await?
                        };

                        let content_values = content_values::table
                            .filter(content_values::content_id.eq(content))
                            .filter(
                                content_values::locale
                                    .eq(format!("{}", locale.current))
                                    .or(content_values::locale.is_null()),
                            )
                            .order((content_values::content_id.asc(), content_values::id.asc()))
                            .select((content_values::model_field_id, content_values::value))
                            .load::<(i32, String)>(&mut conn)
                            .await?;

                        let mut content = BTreeMap::new();

                        for (model_field_id, model_field_name, multiple, kind) in model_fields {
                            let mut values =
                                content_values.iter().filter(|cv| cv.0 == model_field_id);

                            let value = if multiple {
                                Some(Value::from(
                                    values
                                        .map(|v| str_to_value(&kind, &v.1))
                                        .collect::<Vec<_>>(),
                                ))
                            } else {
                                values
                                    .next()
                                    .map(|v| Value::from(str_to_value(&kind, &v.1)))
                            };

                            if let Some(value) = value {
                                content.insert(model_field_name.clone(), value);
                            }
                        }

                        Ok(content)
                    });

                log::debug!("{content:?}");

                content.map_err(|e| Error::new(ErrorKind::InvalidOperation, format!("{e:?}")))
            },
        );
    };

    {
        let pool = pool.clone();

        env.add_function(
            "get_contents",
            move |state: &State, model: String, fields: Vec<String>, args: Kwargs| {
                let locale: Arc<LocaleContext> = state
                    .lookup("locale")
                    .expect("could not find locale in render context")
                    .downcast_object()
                    .expect("locale variable does not have expected type");

                let filter: Option<Vec<String>> = args.get("filter")?;

                if filter.is_none() && args.has("filter") {
                    return Err(Error::new(
                        ErrorKind::InvalidOperation,
                        "invalid parameters",
                    ));
                }

                let pool = pool.clone();

                let values: Result<Vec<Value>, HttpError> = tokio::runtime::Handle::current()
                    .block_on(async move {
                        let mut conn = pool.get().await?;

                        let model_id = models::table
                            .filter(models::name.eq(model))
                            .select(models::id)
                            .first::<i32>(&mut conn)
                            .await?;

                        let model_fields = model_fields::table
                            .inner_join(fields::table)
                            .filter(model_fields::model_id.eq(model_id))
                            .filter(model_fields::name.eq_any(&fields))
                            .select((
                                model_fields::id,
                                model_fields::name,
                                model_fields::multiple,
                                fields::kind,
                            ))
                            .load::<(i32, String, bool, String)>(&mut conn)
                            .await?;

                        let content_values = if let Some(filter) = filter {
                            let (c1, c2) = diesel::alias!(contents as c1, contents as c2);
                            let (mf1, mf2) =
                                diesel::alias!(model_fields as mf1, model_fields as mf2);
                            let (cv1, cv2) =
                                diesel::alias!(content_values as cv1, content_values as cv2);

                            c1.inner_join(models::table)
                                .inner_join(cv1.inner_join(mf1))
                                .filter(models::id.eq(model_id))
                                .filter(mf1.field(model_fields::id).eq_any(
                                    &model_fields.iter().map(|mf| mf.0).collect::<Vec<i32>>(),
                                ))
                                .filter(
                                    cv1.field(content_values::locale)
                                        .eq(format!("{}", locale.current))
                                        .or(cv1.field(content_values::locale).is_null()),
                                )
                                .filter(
                                    c1.field(contents::id).eq_any(
                                        c2.select(c2.field(contents::id))
                                            .inner_join(cv2.inner_join(mf2))
                                            .filter(mf2.field(model_fields::name).eq(&filter[0]))
                                            .filter(
                                                cv2.field(content_values::value).eq(&filter[1]),
                                            ),
                                    ),
                                )
                                .order((
                                    cv1.field(content_values::content_id).asc(),
                                    cv1.field(content_values::id).asc(),
                                ))
                                .select((
                                    c1.field(contents::id),
                                    cv1.field(content_values::model_field_id),
                                    cv1.field(content_values::value),
                                ))
                                .load::<(i32, i32, String)>(&mut conn)
                                .await?
                        } else {
                            contents::table
                                .inner_join(models::table)
                                .inner_join(content_values::table.inner_join(model_fields::table))
                                .filter(models::id.eq(model_id))
                                .filter(model_fields::id.eq_any(
                                    &model_fields.iter().map(|mf| mf.0).collect::<Vec<i32>>(),
                                ))
                                .filter(
                                    content_values::locale
                                        .eq(format!("{}", locale.current))
                                        .or(content_values::locale.is_null()),
                                )
                                .order((content_values::content_id.asc(), content_values::id.asc()))
                                .select((
                                    contents::id,
                                    content_values::model_field_id,
                                    content_values::value,
                                ))
                                .load::<(i32, i32, String)>(&mut conn)
                                .await?
                        };

                        let mut contents = Vec::<Value>::new();

                        // Use BTreeSet to preserve the insertion order
                        let content_ids =
                            BTreeSet::<i32>::from_iter(content_values.iter().map(|cv| cv.0));

                        for id in content_ids {
                            let mut content = BTreeMap::<String, Value>::from_iter([(
                                "id".to_string(),
                                Value::from(id),
                            )]);

                            let values = content_values.iter().filter(|v| v.0 == id);

                            for model_field in model_fields.iter() {
                                let mut values = values.clone().filter(|v| v.1 == model_field.0);

                                let value = if model_field.2 {
                                    Some(Value::from(
                                        values
                                            .map(|v| str_to_value(model_field.3.as_str(), &v.2))
                                            .collect::<Vec<_>>(),
                                    ))
                                } else {
                                    values.next().map(|v| {
                                        Value::from(str_to_value(model_field.3.as_str(), &v.2))
                                    })
                                };

                                if let Some(value) = value {
                                    content.insert(model_field.1.clone(), value);
                                }
                            }

                            contents.push(Value::from(content));
                        }

                        Ok(contents)
                    });

                values.map_err(|e| Error::new(ErrorKind::InvalidOperation, format!("{e:?}")))
            },
        );
    }
}

fn str_to_value(kind: &str, value: &str) -> Value {
    match kind {
        "string" => Value::from(value),
        "integer" => Value::from(str::parse::<i64>(value).unwrap_or(0)),
        unknown => {
            log::error!("Unhandled field kind is found, {unknown}");

            Value::UNDEFINED
        }
    }
}

fn replace_params(mut path: &str, mut params: &[String]) -> Option<String> {
    let mut path_with_params = String::with_capacity(path.len());

    while !path.is_empty() {
        let Some((start, end)) = path.split_once('{') else {
            path_with_params.push_str(path);
            break;
        };

        path_with_params.push_str(start);

        let (_, end) = end.split_once('}')?;

        let param = params.get(0)?;

        path_with_params.push_str(param);

        path = end;
        params = &params[1..];
    }

    Some(path_with_params)
}

fn append_locale_to_path<'a>(
    locale: &LanguageIdentifier,
    default_locale: &LanguageIdentifier,
    path: &str,
) -> String {
    if locale == default_locale {
        return path.to_string();
    }

    if path == "/" {
        format!("/{locale}")
    } else {
        format!("/{locale}{path}")
    }
}

#[cfg(test)]
mod tests {
    use super::{append_locale_to_path, replace_params};

    #[test]
    fn it_replaces_parameters_inside_path_with_values_from_params() {
        assert_eq!(
            "/path/with/params",
            replace_params("/path/{key}/params", &["with".to_string()]).unwrap()
        );

        assert_eq!(
            "/random/url",
            replace_params("/random/{key}", &["url".to_string()]).unwrap()
        );

        assert_eq!(
            "/random/url",
            replace_params("/{key1}/{key2}", &["random".to_string(), "url".to_string()]).unwrap()
        );
    }

    #[test]
    fn it_returns_none_if_given_path_is_invalid_or_insufficient_params() {
        assert!(replace_params("/{/invalid", &[]).is_none());

        assert!(replace_params("/{}/valid-path-with-missing-param", &[]).is_none());
    }

    #[test]
    fn it_appends_locale_to_path() {
        let tr = "tr".parse().unwrap();
        let en = "en".parse().unwrap();

        assert_eq!("/tr/path", append_locale_to_path(&tr, &en, "/path"));

        assert_eq!("/tr", append_locale_to_path(&tr, &en, "/"));

        assert_eq!("/trtest", append_locale_to_path(&tr, &en, "test"));
    }

    #[test]
    fn it_does_not_append_locale_to_path_if_it_is_default_one() {
        let en = "en".parse().unwrap();

        assert_eq!("/", append_locale_to_path(&en, &en, "/"));

        assert_eq!("test", append_locale_to_path(&en, &en, "test"));

        assert_eq!("/path", append_locale_to_path(&en, &en, "/path"));
    }
}
