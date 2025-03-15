use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::ops::Deref;
use std::sync::Arc;

use base::models::HttpError;
use base::schema::{content_values, contents, enum_options, fields, model_fields, models};
use base::types::Pool;
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use minijinja::value::Kwargs;
use minijinja::{Environment, Error, ErrorKind, State};
// use plugin::PluginHost;
use serde::de::DeserializeOwned;
use serde::Serialize;
use tera::{from_value, to_value, Context, Value};
use unic_langid::{LanguageIdentifier, LanguageIdentifierError};

use crate::locale::Locale;

#[derive(Clone)]
pub struct Render(Arc<Inner>);

impl Render {
    pub fn new(templates: Vec<(String, String)>) -> Result<Self, Error> {
        Inner::new(templates).map(|inner| Render(Arc::new(inner)))
    }

    pub fn from_dir(dir: &str, register_fns: Option<(Locale, Pool)>) -> Result<Self, Error> {
        let mut inner = Inner::from_dir(dir)?;

        if let Some((l10n, pool)) = register_fns {
            register_functions(&mut inner.env, l10n, pool);
        }

        Ok(Render(Arc::new(inner)))
    }
}

impl Deref for Render {
    type Target = Inner;

    fn deref(&self) -> &Self::Target {
        &*self.0
    }
}

pub struct Inner {
    env: Environment<'static>,
}

impl Inner {
    pub fn render<C: Serialize>(&self, template: &str, ctx: C) -> Result<String, Error> {
        self.env.get_template(template)?.render(ctx)
    }

    fn new(templates: Vec<(String, String)>) -> Result<Self, Error> {
        let mut env = Environment::new();

        for (name, template) in templates {
            env.add_template_owned(name, template)?;
        }

        Ok(Inner { env })
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

fn register_functions(env: &mut Environment, l10n: Locale, pool: Pool) {
    env.add_function(
        "localize",
        move |state: &State, key: String, kwargs: Kwargs| -> Option<String> {
            let locale = state
                .lookup("locale")
                .expect("could not find locale in render context");

            let locale = locale
                .as_str()
                .expect("locale variable is not string in render context");

            let args = kwargs.args().map(|arg| (arg, kwargs.get(arg).unwrap()));

            l10n.localize(&locale.parse().unwrap(), &key, args)
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

    {
        let pool = pool.clone();
        env.add_function(
            "get_content",
            |state: &State, model: String, field: String, value: String| {
                Kwargs::from_iter([(
                    "mer",
                    minijinja::Value::from(Vec::<minijinja::Value>::new()),
                )])
            },
        );
    }

    {
        let pool = pool.clone();

        env.add_function(
            "get_contents",
            move |state: &State, model: String, fields: Vec<String>, kwargs: Kwargs| {
                let locale: String = if kwargs.has("locale") {
                    kwargs.get::<String>("locale").unwrap()
                } else {
                    let locale = state
                        .lookup("locale")
                        .expect("could not find locale in render context");

                    locale
                        .as_str()
                        .expect("locale variable is not string in render context")
                        .to_string()
                };

                let filter: Option<(String, String)> = kwargs
                    .has("filter")
                    .then(|| -> Result<(String, String), Error> {
                        let filter: [String; 2] = kwargs
                            .get::<Vec<String>>("filter")?
                            .try_into()
                            .map_err(|_| {
                            Error::new(
                                ErrorKind::InvalidOperation,
                                format!("invalid filter is passed"),
                            )
                        })?;

                        let mut iter = filter.into_iter();

                        Ok((iter.next().unwrap(), iter.next().unwrap()))
                    })
                    .transpose()?;

                let pool = pool.clone();

                // Use BTreeMap to preserve the insertion order
                let values: Result<BTreeMap<i32, HashMap<String, minijinja::Value>>, HttpError> =
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
                                        .eq(format!("{locale}"))
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
                                        .eq(format!("{locale}"))
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

                        let mut contents = BTreeMap::<i32, HashMap<String, minijinja::Value>>::new();

                        for (id, field_id, multiple, key, val) in content_values.into_iter() {
                            let Some(field) = fields.iter().find(|f| f.0 == field_id) else {
                                log::error!("A content without a corresponding field is identified, field_id {field_id}");
                                continue;
                            };

                            let values = contents.entry(id)
                                .or_insert_with(|| HashMap::from([("id".to_string(), minijinja::Value::from(id))]));

                            if multiple && !values.contains_key(&key) {
                                values.insert(key.clone(), minijinja::Value::from(Vec::<minijinja::Value>::new()));
                            }

                            let val = match field.1.as_ref() {
                                "string" => minijinja::Value::from(val),
                                "integer" => {
                                    if let Ok(num) = str::parse::<i64>(val.as_ref().map(|s| s.as_str()).unwrap_or("")) {
                                        minijinja::Value::from(num)
                                    } else {
                                        log::warn!("failed to parse number value");

                                        minijinja::Value::UNDEFINED
                                    }
                                },
                                unknown => {
                                    log::error!("Unhandled field kind is found, {unknown}");

                                    minijinja::Value::UNDEFINED
                                }
                            };

                            if multiple {
                                values.get_mut(&key).unwrap().downcast_object_ref::<Vec<minijinja::Value>>().unwrap().push(val);
                            } else {
                                values.insert(key, val);
                            }
                        }

                        Ok(contents)
                    });

                /*
                values
                    .map(|map| Vec::from_iter(map.into_iter().map(|(_, val)| val)))
                    .map_err(|e| Error::new(ErrorKind::UndefinedError, format!("failed to get content, {e:?}")))
                */

                Ok(vec![minijinja::Value::from(Kwargs::from_iter([(
                    "merhaba",
                    minijinja::Value::from("test"),
                )]))])
            },
        );
    }
}

pub struct Inner2 {
    tera: tera::Tera,
}

impl Inner2 {
    pub fn render(&self, template: &str, ctx: &Context) -> tera::Result<String> {
        self.tera.render(template, ctx)
    }
}

fn invalid_args() -> tera::Error {
    "invalid args".into()
}

fn invalid_locale(_: LanguageIdentifierError) -> tera::Error {
    "invalid locale".into()
}

fn get_value<T: DeserializeOwned>(args: &HashMap<String, Value>, k: &str) -> Option<T> {
    args.get(k).cloned().and_then(|v| from_value::<T>(v).ok())
}

pub fn register_functions2(
    render: &mut Inner2,
    l10n: Locale,
    current_locale: LanguageIdentifier,
    params: HashMap<String, String>,
    pool: Pool,
    // plugin_host: PluginHost,
) {
    render.tera.register_function(
        "localize_url",
        |args: &HashMap<String, Value>| -> tera::Result<Value> {
            let path = get_value::<String>(args, "path").ok_or_else(invalid_args)?;

            Ok(to_value(path).unwrap())
        },
    );

    {
        let current_locale = current_locale.clone();

        render.tera.register_function(
            "localize",
            move |args: &HashMap<String, Value>| -> tera::Result<Value> {
                let key = get_value::<String>(args, "key").ok_or_else(invalid_args)?;
                let locale = get_value::<String>(args, "locale")
                    .map(|locale| locale.parse())
                    .transpose()
                    .map_err(invalid_locale)?;

                let locale = locale.as_ref().unwrap_or(&current_locale);

                let text = l10n
                    .localize(
                        locale,
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
    }

    render.tera.register_function(
        "asset_url",
        move |args: &HashMap<String, Value>| -> tera::Result<Value> {
            let path = get_value::<String>(args, "path").ok_or_else(invalid_args)?;

            match get_value::<String>(args, "kind")
                .as_ref()
                .map(|kind| kind.as_str())
            {
                Some("content") => Ok(to_value(format!("/assets/content/{path}")).unwrap()),
                None => Ok(to_value(format!("/assets/static/{path}")).unwrap()),
                _ => Err("unhandled asset kind".into()),
            }
        },
    );

    render.tera.register_function(
        "route_param",
        move |args: &HashMap<String, Value>| -> tera::Result<Value> {
            let param = get_value::<String>(args, "param").ok_or_else(invalid_args)?;

            Ok(to_value(params.get(&param)).unwrap())
        },
    );

    {
        let pool = pool.clone();
        let current_locale = current_locale.clone();

        render.tera.register_function(
            "get_content",
            move |args: &HashMap<String, Value>| -> tera::Result<Value> {
                let model = get_value::<String>(args, "model").ok_or_else(invalid_args)?;
                let field = get_value::<String>(args, "field").ok_or_else(invalid_args)?;
                let value = get_value::<String>(args, "value").ok_or_else(invalid_args)?;

                let locale = get_value::<String>(args, "locale")
                    .map(|locale| locale.parse())
                    .transpose()
                    .map_err(invalid_locale)?;

                let locale = locale.as_ref().unwrap_or(&current_locale);

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
                                    .eq(format!("{locale}"))
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
        let current_locale = current_locale.clone();

        render.tera.register_function(
            "get_contents",
            move |args: &HashMap<String, Value>| -> tera::Result<Value> {
                let model = get_value::<String>(args, "model").ok_or_else(invalid_args)?;
                let fields = get_value::<Vec<String>>(args, "fields").ok_or_else(invalid_args)?;

                let locale = get_value::<String>(args, "locale")
                    .map(|locale| locale.parse())
                    .transpose()
                    .map_err(invalid_locale)?;
                let locale = locale.as_ref().unwrap_or(&current_locale);

                let filter = get_value::<(String, String)>(args, "filter");

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
                                        .eq(format!("{locale}"))
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
                                        .eq(format!("{locale}"))
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

    render.tera.register_function(
        "get_enum_id",
        move |args: &HashMap<String, Value>| -> tera::Result<Value> {
            let (field, value) = match (
                get_value::<String>(args, "field"),
                get_value::<String>(args, "value"),
            ) {
                (Some(field), Some(value)) => (field, value),
                _ => return Err("invalid args".into()),
            };

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

    // render.tera.register_function(
    //     "call_plugin",
    //     move |args: &HashMap<String, Value>| -> tera::Result<Value> {
    //         let (plugin, fn_id, opts) = match (
    //             get_value::<String>(args, "plugin"),
    //             get_value::<String>(args, "fn_id"),
    //             get_value::<Vec<String>>(args, "opts"),
    //         ) {
    //             (Some(plugin), Some(fn_id), Some(opts)) => (plugin, fn_id, opts),
    //             _ => return Err("invalid args".into()),
    //         };

    //         let plugin_host = plugin_host.clone();

    //         let values: Result<String, HttpError> =
    //             tokio::runtime::Handle::current().block_on(async move {
    //                 plugin_host
    //                     .run_render_handler(&plugin, &fn_id, &opts)
    //                     .await
    //                     .inspect_err(|e| log::warn!("failed to run render handler, {e:?}"))
    //                     .map_err(|_| {
    //                         HttpError::internal_server_error("failed_running_render_plugin")
    //                     })
    //             });

    //         values
    //             .map(|v| to_value(v).unwrap())
    //             .map_err(|e| format!("failed to get content, {e:?}").into())
    //     },
    // );
}
