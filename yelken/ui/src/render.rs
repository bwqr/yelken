use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::sync::Arc;

use arc_swap::{access::Access, ArcSwap};
use base::models::HttpError;
use base::schema::{content_values, contents, enum_options, fields, model_fields, models};
use base::types::Pool;
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
// use plugin::PluginHost;
use tera::{from_value, to_value, Context, Error, Tera, Value};
use unic_langid::{LanguageIdentifier, LanguageIdentifierError};

use crate::l10n::Locale;

#[cfg(feature = "plugin")]
pub type FnResources = (Locale, Pool, plugin::PluginHost);
#[cfg(not(feature = "plugin"))]
pub type FnResources = (Locale, Pool);

#[derive(Clone)]
pub struct Render(Arc<ArcSwap<Inner>>);

impl Render {
    #[cfg(test)]
    pub fn new(templates: Vec<(String, String)>) -> Result<Self, Error> {
        Inner::new(templates).map(|inner| Render(Arc::new(ArcSwap::new(Arc::new(inner)))))
    }

    pub fn from_dir(dir: &str, register_fns: Option<FnResources>) -> Result<Self, Error> {
        let mut inner = Inner::from_dir(dir)?;

        if let Some(resources) = register_fns {
            register_functions(&mut inner.tera, resources);
        }

        Ok(Render(Arc::new(ArcSwap::new(Arc::new(inner)))))
    }

    pub fn render(&self, template: &str, ctx: &Context) -> Result<String, Error> {
        Access::<Inner>::load(&*self.0).tera.render(template, ctx)
    }

    pub fn refresh(&self, dir: &str, register_fns: Option<FnResources>) -> Result<(), Error> {
        let mut inner = Inner::from_dir(dir)?;

        if let Some(resources) = register_fns {
            register_functions(&mut inner.tera, resources);
        }

        self.0.store(Arc::new(inner));

        Ok(())
    }
}

pub struct Inner {
    tera: Tera,
}

impl Inner {
    fn new(templates: Vec<(String, String)>) -> Result<Self, Error> {
        let mut tera = Tera::default();

        tera.add_raw_templates(templates)?;

        Ok(Inner { tera })
    }

    fn from_dir(root: &str) -> Result<Self, Error> {
        let mut stack = vec![fs::read_dir(root).unwrap()];
        let mut templates = vec![];

        while let Some(dir) = stack.pop() {
            for entry in dir {
                let entry = entry.unwrap();
                let path = entry.path();

                if path.is_symlink() {
                    continue;
                }

                if path.is_dir() {
                    stack.push(fs::read_dir(path).unwrap());
                } else if path.is_file()
                    && path
                        .extension()
                        .and_then(|ext| ext.to_str())
                        .map(|ext| ext == "html")
                        .unwrap_or(false)
                {
                    let template = fs::read_to_string(&path).unwrap();

                    templates.push((
                        path.strip_prefix(root)
                            .unwrap()
                            .to_string_lossy()
                            .to_string(),
                        template,
                    ));
                }
            }
        }

        Self::new(templates)
    }
}

fn invalid_args() -> tera::Error {
    "invalid args".into()
}

fn invalid_locale(_: LanguageIdentifierError) -> tera::Error {
    "invalid locale".into()
}

pub fn register_functions(tera: &mut Tera, resources: FnResources) {
    #[cfg(feature = "plugin")]
    let (l10n, pool, plugin_host) = resources;
    #[cfg(not(feature = "plugin"))]
    let (l10n, pool) = resources;

    tera.register_function(
        "localize_url",
        |args: &HashMap<String, Value>| -> tera::Result<Value> {
            let locale = args
                .get("locale")
                .and_then(|v| v.as_str())
                .ok_or_else(invalid_args)?;

            let default_locale = args
                .get("default_locale")
                .and_then(|v| v.as_str())
                .ok_or_else(invalid_args)?;

            if let Some(name) = args.get("page").and_then(|v| v.as_str()) {
                let pages: Vec<&tera::Map<String, Value>> = args
                    .get("pages")
                    .and_then(|v| v.as_array())
                    .map(|v| v.iter().flat_map(|f| f.as_object()).collect())
                    .ok_or_else(invalid_args)?;

                let path_params: Vec<&str> = args.get("params")
                    .and_then(|v| v.as_array())
                    .map(|v| v.iter().flat_map(|f| f.as_str()).collect())
                    .ok_or_else(invalid_args)?;

                for p in pages {
                    let Some(page_name) = p.get("name").and_then(|v| v.as_str()) else {
                        log::error!("Invalid page is encountered in localize_url, name is missing from the page");

                        return Err(invalid_args());
                    };

                    let Some(page_locale) = p.get("locale").and_then(|v| v.as_str()) else {
                        log::error!("Invalid page is encountered in localize_url, locale is missing from the page");

                        return Err(invalid_args());
                    };

                    if name != page_name || locale != page_locale {
                        continue;
                    }

                    let Some(path) = p.get("path").and_then(|v| v.as_str()) else {
                        log::error!("Invalid page is encountered in localize_url, path is missing from the page");

                        return Err(invalid_args());
                    };

                    let Some(path) = replace_params(path, &path_params) else {
                        log::warn!("Invalid path or param is received while in localize_url, {path}, {path_params:?}");
                        return Err(invalid_args());
                    };

                    return Ok(to_value(append_locale_to_path(&locale, &default_locale, &path)).unwrap());
                }

                return Err("unknown page".into());
            } else if let Some(path) = args.get("path").and_then(|v| v.as_str()) {
                return Ok(to_value(append_locale_to_path(locale, default_locale, path)).unwrap());
            } else {
                return Err(invalid_args());
            }
        },
    );

    tera.register_function(
        "localize",
        move |args: &HashMap<String, Value>| -> tera::Result<Value> {
            let key = args
                .get("key")
                .and_then(|v| v.as_str())
                .ok_or_else(invalid_args)?;

            let locale = args
                .get("locale")
                .and_then(|v| v.as_str())
                .map(|locale| locale.parse::<LanguageIdentifier>())
                .ok_or_else(invalid_args)?
                .map_err(invalid_locale)?;

            let text = l10n
                .localize(
                    &locale,
                    &key,
                    args.into_iter().filter_map(|(key, val)| {
                        if key == "key" || key == "locale" {
                            return None;
                        };

                        Some((key.as_str(), val.as_str()?))
                    }),
                )
                .ok_or_else(|| -> tera::Error { format!("Unknown key {key}").into() })?;

            Ok(to_value(text).unwrap())
        },
    );

    tera.register_function(
        "asset_url",
        move |args: &HashMap<String, Value>| -> tera::Result<Value> {
            let path = args
                .get("path")
                .and_then(|v| v.as_str())
                .ok_or_else(invalid_args)?;

            match args.get("kind").and_then(|v| v.as_str()) {
                Some("content") => Ok(to_value(format!("/assets/content/{path}")).unwrap()),
                None => Ok(to_value(format!("/assets/static/{path}")).unwrap()),
                _ => Err("unhandled asset kind".into()),
            }
        },
    );

    {
        let pool = pool.clone();

        tera.register_function(
            "get_content",
            move |args: &HashMap<String, Value>| -> tera::Result<Value> {
                let model = args.get("model").and_then(|v| v.as_str()).ok_or_else(invalid_args)?;
                let field = args.get("field").and_then(|v| v.as_str()).ok_or_else(invalid_args)?;
                let value = args.get("value").and_then(|v| v.as_str()).ok_or_else(invalid_args)?;

                let locale = args.get("locale")
                    .and_then(|v| v.as_str())
                    .ok_or_else(invalid_args)?;

                let pool = pool.clone();

                let values: Result<HashMap<String, Value>, HttpError> =
                    tokio::runtime::Handle::current().block_on(async move {
                        let mut conn = pool.get().await?;

                        let fields = fields::table
                            .select((fields::id, fields::kind))
                            .load::<(i32, String)>(&mut conn)
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
                            let model_field = model_fields::table
                                .select(model_fields::id)
                                .inner_join(models::table)
                                .filter(
                                    model_fields::model_id
                                        .eq(models::id)
                                        .and(model_fields::name.eq(field))
                                        .and(models::name.eq(model)),
                                )
                                .first::<i32>(&mut conn)
                                .await?;

                            contents::table
                                .select(contents::id)
                                .inner_join(content_values::table)
                                .filter(
                                    content_values::model_field_id
                                        .eq(model_field)
                                        .and(content_values::value.eq(value)),
                                )
                                .first::<i32>(&mut conn)
                                .await?
                        };

                        let content_values = content_values::table
                            .inner_join(model_fields::table)
                            .filter(content_values::content_id.eq(content))
                            .filter(
                                content_values::locale
                                    .eq(locale)
                                    .or(content_values::locale.is_null()),
                            )
                            .order((content_values::content_id.asc(), content_values::id.asc()))
                            .select((model_fields::field_id, model_fields::multiple, model_fields::name, content_values::value))
                            .load::<(i32, bool, String, Option<String>)>(&mut conn)
                            .await?;

                        let mut values = HashMap::new();

                        for (field_id, multiple, key, val) in content_values.into_iter() {
                            let Some(field) = fields.iter().find(|f| f.0 == field_id) else {
                                log::error!("A content without a corresponding field is identified, field_id {field_id}");
                                continue;
                            };

                            if multiple && !values.contains_key(&key) {
                                values.insert(key.clone(), to_value(Vec::<Value>::new()).unwrap());
                            }

                            let val = match field.1.as_ref() {
                                "string" => to_value(val).unwrap(),
                                "integer" => {
                                    if let Ok(num) = str::parse::<i64>(val.as_ref().map(|s| s.as_str()).unwrap_or("")) {
                                        to_value(num).unwrap()
                                    } else {
                                        log::warn!("failed to parse number value");

                                        Value::Null
                                    }
                                },
                                unknown => {
                                    log::error!("Unhandled field kind is found, {unknown}");

                                    Value::Null
                                }
                            };

                            if multiple {
                                values.get_mut(&key).unwrap().as_array_mut().unwrap().push(val);
                            } else {
                                values.insert(key, to_value(val).unwrap());
                            }
                        }

                        Ok(values)
                    });

                values
                    .map(|v| to_value(v).unwrap())
                    .map_err(|e| format!("failed to get content, {e:?}").into())
            },
        );
    }

    {
        let pool = pool.clone();

        tera.register_function(
            "get_contents",
            move |args: &HashMap<String, Value>| -> tera::Result<Value> {
                let model = args.get("model").and_then(|v| v.as_str()).ok_or_else(invalid_args)?;
                let fields: Vec<&str> = args
                    .get("fields")
                    .and_then(|v| v.as_array())
                    .map(|v| v.iter().filter_map(|f| f.as_str()).collect())
                    .ok_or_else(invalid_args)?;

                let locale = args.get("locale")
                    .and_then(|v| v.as_str())
                    .ok_or_else(invalid_args)?;

                let filter = args.get("filter")
                    .cloned()
                    .and_then(|v| from_value::<(String, String)>(v).ok());

                if filter.is_none() && args.contains_key("filter") {
                    return Err("invalid args".into());
                }

                let pool = pool.clone();

                // Use BTreeMap to preserve the insertion order
                let values: Result<BTreeMap<i32, Value>, HttpError> =
                    tokio::runtime::Handle::current().block_on(async move {
                        let mut conn = pool.get().await?;

                        let content_values = if let Some(filter) = filter {
                            let (c1, c2) = diesel::alias!(contents as c1, contents as c2);
                            let (mf1, mf2) = diesel::alias!(model_fields as mf1, model_fields as mf2);
                            let (cv1, cv2) = diesel::alias!(content_values as cv1, content_values as cv2);

                            c1
                                .inner_join(models::table)
                                .inner_join(cv1.inner_join(mf1))
                                .filter(models::name.eq(&model))
                                .filter(mf1.field(model_fields::name).eq_any(&fields))
                                .filter(
                                    cv1.field(content_values::locale)
                                        .eq(locale)
                                        .or(cv1.field(content_values::locale).is_null()),
                                )
                                .filter(
                                    c1.field(contents::id).eq_any(
                                        c2.select(c2.field(contents::id))
                                            .inner_join(cv2.inner_join(mf2))
                                            .filter(mf2.field(model_fields::name).eq(&filter.0))
                                            .filter(cv2.field(content_values::value).eq(&filter.1))
                                    )
                                )
                                .order((cv1.field(content_values::content_id).asc(), cv1.field(content_values::id).asc()))
                                .select((
                                    c1.field(contents::id),
                                    mf1.field(model_fields::field_id),
                                    mf1.field(model_fields::multiple),
                                    mf1.field(model_fields::name),
                                    cv1.field(content_values::value)
                                ))
                                .load::<(i32, i32, bool, String, Option<String>)>(&mut conn)
                                .await?
                        } else {
                            contents::table
                                .inner_join(models::table)
                                .inner_join(content_values::table.inner_join(model_fields::table))
                                .filter(models::name.eq(&model))
                                .filter(model_fields::name.eq_any(&fields))
                                .filter(
                                    content_values::locale
                                        .eq(locale)
                                        .or(content_values::locale.is_null()),
                                )
                                .order((content_values::content_id.asc(), content_values::id.asc()))
                                .select((contents::id, model_fields::field_id, model_fields::multiple, model_fields::name, content_values::value))
                                .load::<(i32, i32, bool, String, Option<String>)>(&mut conn)
                                .await?
                        };

                        let fields = fields::table
                            .select((fields::id, fields::kind))
                            .load::<(i32, String)>(&mut conn)
                            .await?;

                        let mut contents = BTreeMap::<i32, Value>::new();

                        for (id, field_id, multiple, key, val) in content_values.into_iter() {
                            let Some(field) = fields.iter().find(|f| f.0 == field_id) else {
                                log::error!("A content without a corresponding field is identified, field_id {field_id}");
                                continue;
                            };

                            let values = contents.entry(id).or_insert_with(|| to_value(HashMap::<String, Value>::from([("id".to_string(), to_value(id).unwrap())])).unwrap()).as_object_mut().unwrap();

                            if multiple && !values.contains_key(&key) {
                                values.insert(key.clone(), to_value(Vec::<Value>::new()).unwrap());
                            }

                            let val = match field.1.as_ref() {
                                "string" => to_value(val).unwrap(),
                                "integer" => {
                                    if let Ok(num) = str::parse::<i64>(val.as_ref().map(|s| s.as_str()).unwrap_or("")) {
                                        to_value(num).unwrap()
                                    } else {
                                        log::warn!("failed to parse number value");

                                        Value::Null
                                    }
                                },
                                unknown => {
                                    log::error!("Unhandled field kind is found, {unknown}");

                                    Value::Null
                                }
                            };

                            if multiple {
                                values.get_mut(&key).unwrap().as_array_mut().unwrap().push(val);
                            } else {
                                values.insert(key, to_value(val).unwrap());
                            }
                        }

                        Ok(contents)
                    });

                values
                    .map(|map| to_value(Vec::from_iter(map.into_iter().map(|(_, val)| val))).unwrap())
                    .map_err(|e| format!("failed to get content, {e:?}").into())
            },
        );
    }

    tera.register_function(
        "get_enum_id",
        move |args: &HashMap<String, Value>| -> tera::Result<Value> {
            let field = args
                .get("field")
                .and_then(|v| v.as_str())
                .ok_or_else(invalid_args)?;

            let value = args
                .get("value")
                .and_then(|v| v.as_str())
                .ok_or_else(invalid_args)?;

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

            id.map(|id| to_value(id.to_string()).unwrap())
                .map_err(|e| format!("failed to get content, {e:?}").into())
        },
    );

    #[cfg(feature = "plugin")]
    {
        tera.register_function(
            "call_plugin",
            move |args: &HashMap<String, Value>| -> tera::Result<Value> {
                let plugin = args
                    .get("plugin")
                    .and_then(|v| v.as_str())
                    .ok_or_else(invalid_args)?;

                let fn_id = args
                    .get("fn_id")
                    .and_then(|v| v.as_str())
                    .ok_or_else(invalid_args)?;

                let opts: Vec<&str> = args
                    .get("opts")
                    .and_then(|v| v.as_array())
                    .map(|v| v.iter().flat_map(|f| f.as_str()).collect())
                    .ok_or_else(invalid_args)?;

                let plugin_host = plugin_host.clone();

                let values: Result<String, HttpError> =
                    tokio::runtime::Handle::current().block_on(async move {
                        plugin_host
                            .run_render_handler(&plugin, &fn_id, &opts)
                            .await
                            .inspect_err(|e| log::warn!("failed to run render handler, {e:?}"))
                            .map_err(|_| {
                                HttpError::internal_server_error("failed_running_render_plugin")
                            })
                    });

                values
                    .map(|v| to_value(v).unwrap())
                    .map_err(|e| format!("failed to get content, {e:?}").into())
            },
        );
    }
}

fn replace_params(mut path: &str, mut params: &[&str]) -> Option<String> {
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

fn append_locale_to_path<'a>(locale: &str, default_locale: &str, path: &str) -> String {
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
            replace_params("/path/{key}/params", &["with"]).unwrap()
        );

        assert_eq!(
            "/random/url",
            replace_params("/random/{key}", &["url"]).unwrap()
        );

        assert_eq!(
            "/random/url",
            replace_params("/{key1}/{key2}", &["random", "url"]).unwrap()
        );
    }

    #[test]
    fn it_returns_none_if_given_path_is_invalid_or_insufficient_params() {
        assert!(replace_params("/{/invalid", &[]).is_none());

        assert!(replace_params("/{}/valid-path-with-missing-param", &[]).is_none());
    }

    #[test]
    fn it_appends_locale_to_path() {
        assert_eq!("/tr/path", append_locale_to_path("tr", "en", "/path"));

        assert_eq!("/tr", append_locale_to_path("tr", "en", "/"));

        assert_eq!("/trtest", append_locale_to_path("tr", "en", "test"));
    }

    #[test]
    fn it_does_not_append_locale_to_path_if_it_is_default_one() {
        assert_eq!("/", append_locale_to_path("en", "en", "/"));

        assert_eq!("test", append_locale_to_path("en", "en", "test"));

        assert_eq!("/path", append_locale_to_path("en", "en", "/path"));
    }
}
