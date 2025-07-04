use std::collections::{BTreeMap, HashMap};
use std::sync::Arc;

use arc_swap::ArcSwap;
use base::db::Pool;
use base::models::ContentStage;
use base::runtime::{block_on, IntoSendFuture};
use base::schema::{content_values, contents, fields, model_fields, models};
use context::Context;
use minijinja::value::Kwargs;
use minijinja::{Environment, Error, ErrorKind, State, Value};
use opendal::{EntryMode, Operator};

use crate::l10n::L10n;

#[derive(Debug)]
enum RenderError {
    Database(diesel::result::Error),
    Pool(diesel_async::pooled_connection::deadpool::PoolError),
}

pub mod context {
    use minijinja::value::{Object, Value};
    use std::{
        collections::BTreeMap,
        sync::{atomic::AtomicU16, Arc},
    };
    use unic_langid::LanguageIdentifier;
    use url::Url;

    #[derive(Debug)]
    pub struct Pagination {
        pub per_page: i64,
        pub current_page: i64,
        pub total_pages: i64,
        pub total_items: i64,
        pub items: Arc<[Value]>,
    }

    impl Object for Pagination {
        fn get_value(self: &Arc<Self>, key: &Value) -> Option<Value> {
            match key.as_str()? {
                "per_page" => Some(Value::from(self.per_page)),
                "current_page" => Some(Value::from(self.current_page)),
                "total_pages" => Some(Value::from(self.total_pages)),
                "total_items" => Some(Value::from(self.total_items)),
                "items" => Some(Value::from_iter(self.items.into_iter().cloned())),
                _ => None,
            }
        }
    }

    #[derive(Debug)]
    pub struct L10n {
        pub locales: Box<[Arc<Locale>]>,
        pub default: Arc<Locale>,
    }

    impl Object for L10n {
        fn get_value(self: &Arc<Self>, key: &Value) -> Option<Value> {
            match key.as_str()? {
                "locales" => Some(Value::from_iter(
                    self.locales
                        .iter()
                        .map(|l| Value::from_dyn_object(Arc::clone(&l))),
                )),
                _ => None,
            }
        }
    }

    #[derive(Debug)]
    pub struct Page {
        pub key: String,
        pub locale: Option<String>,
        pub path: String,
    }

    #[derive(Debug)]
    pub struct Internal {
        pub site_url: Url,
        pub namespace: String,
        pub pages: Box<[Page]>,
    }

    impl Object for Internal {}

    #[derive(Clone, Debug)]
    pub struct Locale {
        pub id: LanguageIdentifier,
        pub key: Arc<str>,
        pub name: Arc<str>,
    }

    impl Object for Locale {
        fn get_value(self: &Arc<Self>, key: &Value) -> Option<Value> {
            match key.as_str()? {
                "key" => Some(Value::from(Arc::clone(&self.key))),
                "name" => Some(Value::from(Arc::clone(&self.name))),
                _ => None,
            }
        }
    }

    #[derive(Debug)]
    pub struct Request {
        pub locale: Arc<Locale>,
        pub options: Arc<BTreeMap<String, String>>,
        pub params: Arc<BTreeMap<String, String>>,
        pub search_params: Arc<BTreeMap<String, String>>,
    }

    impl Object for Request {
        fn get_value(self: &Arc<Self>, key: &Value) -> Option<Value> {
            match key.as_str()? {
                "locale" => Some(Value::from_dyn_object(Arc::clone(&self.locale))),
                "options" => Some(Value::from_dyn_object(Arc::clone(&self.options))),
                "params" => Some(Value::from_dyn_object(Arc::clone(&self.params))),
                "search_params" => Some(Value::from_dyn_object(Arc::clone(&self.search_params))),
                _ => None,
            }
        }
    }

    #[derive(Debug)]
    pub struct Response {
        pub status: AtomicU16,
    }

    impl Object for Response {
        fn call_method(
            self: &Arc<Self>,
            _: &minijinja::State<'_, '_>,
            method: &str,
            args: &[Value],
        ) -> Result<Value, minijinja::Error> {
            match method {
                "set_status" => {
                    let code = args
                        .get(0)
                        .ok_or_else(|| {
                            minijinja::Error::from(minijinja::ErrorKind::MissingArgument)
                        })?
                        .as_i64()
                        .ok_or_else(|| {
                            minijinja::Error::from(minijinja::ErrorKind::InvalidOperation)
                        })? as u16;

                    self.status
                        .store(code, std::sync::atomic::Ordering::Relaxed);

                    Ok(Value::from(Option::<()>::None))
                }
                _ => Err(minijinja::Error::from(minijinja::ErrorKind::UnknownMethod)),
            }
        }
    }

    #[derive(Debug)]
    pub struct Context {
        pub(super) request: Arc<Request>,
        pub(super) response: Arc<Response>,
        pub(super) l10n: Arc<L10n>,
        pub(super) internal: Arc<Internal>,
    }

    impl Object for Context {
        fn get_value(self: &Arc<Self>, key: &Value) -> Option<Value> {
            match key.as_str()? {
                "request" => Some(Value::from_dyn_object(Arc::clone(&self.request))),
                "response" => Some(Value::from_dyn_object(Arc::clone(&self.response))),
                "l10n" => Some(Value::from_dyn_object(Arc::clone(&self.l10n))),
                "__internal__" => Some(Value::from_dyn_object(Arc::clone(&self.internal))),
                _ => None,
            }
        }
    }

    impl Context {
        pub fn new(request: Request, l10n: L10n, internal: Internal) -> Self {
            Self {
                request: Arc::new(request),
                l10n: Arc::new(l10n),
                internal: Arc::new(internal),
                response: Arc::new(Response {
                    status: AtomicU16::new(0),
                }),
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
            .list_with(&location)
            .recursive(true)
            .into_send_future()
            .await
            .inspect_err(|e| log::debug!("Failed to read directory {location:?} {e:?}"))
        else {
            continue;
        };

        let prefix = format!("{}/", location);

        for entry in entries {
            if entry.metadata().mode() != EntryMode::FILE || !entry.path().ends_with(".html") {
                continue;
            }

            let Some(key) = entry.path().strip_prefix(&prefix) else {
                log::debug!(
                    "Encoutered invalid prefix while loading template {}",
                    entry.path()
                );

                continue;
            };

            if !templates.contains_key(key) {
                log::debug!("loading template file {}", entry.path());

                let Ok(bytes) = storage
                    .read(entry.path())
                    .into_send_future()
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

    pub fn render(&self, template: &str, ctx: Context) -> Result<(String, Option<u16>), Error> {
        #[derive(Debug)]
        struct Root {
            ctx: Arc<Context>,
        }

        impl minijinja::value::Object for Root {
            fn get_value(self: &Arc<Self>, key: &Value) -> Option<Value> {
                match key.as_str()? {
                    "ctx" => Some(Value::from_dyn_object(Arc::clone(&self.ctx))),
                    _ => self.ctx.get_value(key),
                }
            }
        }

        let env = (*self.env).load();

        let template = env.get_template(template)?;

        let (html, state) =
            template.render_and_return_state(Value::from_object(Root { ctx: Arc::new(ctx) }))?;

        let ctx: Arc<Context> = state
            .lookup("ctx")
            .expect("could not find render context")
            .downcast_object()
            .expect("context does not have expected type");

        let status = ctx
            .response
            .status
            .load(std::sync::atomic::Ordering::Relaxed);

        Ok((html, (status != 0).then_some(status)))
    }
}

fn register_functions(env: &mut Environment, resources: FnResources) {
    #[cfg(feature = "plugin")]
    let (l10n, pool, plugin_host) = resources;
    #[cfg(not(feature = "plugin"))]
    let (l10n, pool) = resources;

    env.add_function(
        "localize",
        move |state: &State, key: String, kwargs: Kwargs| -> Option<String> {
            let ctx: Arc<Context> = state
                .lookup("ctx")
                .expect("could not find render context")
                .downcast_object()
                .expect("context does not have expected type");

            let args = kwargs.args().map(|arg| (arg, kwargs.get(arg).unwrap()));

            l10n.localize(&ctx.request.locale.id, &key, args)
        },
    );

    env.add_function(
        "asset_url",
        |state: &State, path: String, kwargs: Kwargs| {
            let ctx: Arc<Context> = state
                .lookup("ctx")
                .expect("could not find render context")
                .downcast_object()
                .expect("context does not have expected type");

            let base_url = ctx.internal.site_url.clone();

            let kind = kwargs.get::<&str>("kind").unwrap_or("theme");

            match kind {
                "theme" | "content" => {
                    let mut base_url = base_url;

                    base_url
                        .path_segments_mut()
                        .unwrap()
                        .push("assets")
                        .push(kind)
                        .extend(path.split('/'));

                    Ok(Value::from_safe_string(base_url.to_string()))
                }
                unknown => Err(Error::new(
                    ErrorKind::InvalidOperation,
                    format!("unknown asset kind {unknown}"),
                )),
            }
        },
    );

    env.add_function("get_url", |state: &State, args: Kwargs| {
        let ctx: Arc<Context> = state
            .lookup("ctx")
            .expect("could not find render context")
            .downcast_object()
            .expect("context does not have expected type");

        let mut url = ctx.internal.site_url.clone();

        if let Some(key) = args.get::<'_, Option<String>>("page")? {
            let path_params: Vec<String> = args.get("params")?;

            for p in ctx.internal.pages.iter() {
                if key != p.key
                    || p.locale
                        .as_ref()
                        .map(|l| *l != &*ctx.request.locale.key)
                        // If page does not have a locale, still match it
                        .unwrap_or(false)
                {
                    continue;
                }

                let Some(path) = replace_params(&p.path, &path_params) else {
                    log::warn!(
                        "Invalid path or param is received while in get_url, {}, {path_params:?}",
                        p.path
                    );

                    return Err(Error::new(
                        ErrorKind::InvalidOperation,
                        "invalid parameters",
                    ));
                };

                {
                    let mut path_segments = url.path_segments_mut().unwrap();
                    path_segments.pop_if_empty();

                    if ctx.request.locale.key != ctx.l10n.default.key {
                        path_segments.push(&*ctx.request.locale.key);
                    }

                    path_segments.extend(path.split('/').filter(|p| !p.is_empty()));
                }

                return Ok(Value::from_safe_string(url.to_string()));
            }

            return Err(Error::new(ErrorKind::InvalidOperation, "page not found"));
        } else if let Some(path) = args.get::<'_, Option<String>>("path")? {
            let localize = args
                .get::<'_, Option<bool>>("localize")
                .unwrap_or(Some(true))
                .unwrap_or(true);

            {
                let mut path_segments = url.path_segments_mut().unwrap();
                path_segments.pop_if_empty();

                if localize && ctx.request.locale.key != ctx.l10n.default.key {
                    path_segments.push(&*ctx.request.locale.key);
                }

                path_segments.extend(path.split('/').filter(|p| !p.is_empty()));
            }

            return Ok(Value::from_safe_string(url.to_string()));
        }

        return Err(Error::new(
            ErrorKind::InvalidOperation,
            "invalid parameters",
        ));
    });

    {
        let pool = pool.clone();

        env.add_function(
            "get_content",
            move |state: &State, model: String, field: String, value: String| {
                let ctx: Arc<Context> = state
                    .lookup("ctx")
                    .expect("could not find render context")
                    .downcast_object()
                    .expect("context does not have expected type");

                block_on(
                    ContentSource {
                        pool: pool.clone(),
                        namespace: ctx.internal.namespace.clone(),
                        locale: ctx.request.locale.key.to_string(),
                        model,
                        fields: None,
                        filter: Some((field, value)),
                        limit: Some(1),
                        offset: None,
                        count: false,
                    }
                    .get(),
                )
                .inspect_err(|e| match e {
                    RenderError::Database(e) => {
                        log::error!("Database error occurred during rendering, {e:?}")
                    }
                    RenderError::Pool(e) => {
                        log::error!("Pool error occurred during rendering, {e:?}")
                    }
                })
                .map(|values| values.map(|v| v.0).and_then(|mut v| v.pop()))
                .map_err(|_| Error::new(ErrorKind::InvalidOperation, "RenderError"))
            },
        );
    };

    {
        let pool = pool.clone();

        env.add_function(
            "paginate",
            move |state: &State, model: String, fields: Vec<String>, args: Kwargs| {
                let ctx: Arc<Context> = state
                    .lookup("ctx")
                    .expect("could not find render context")
                    .downcast_object()
                    .expect("context does not have expected type");

                let per_page = args.get::<Option<i64>>("per_page")?.unwrap_or(20);
                let limit = std::cmp::min(per_page, 100);

                let page = args.get::<Option<i64>>("page")?.unwrap_or(1);
                let offset = std::cmp::max(page - 1, 0) * per_page;

                block_on(
                    ContentSource {
                        pool: pool.clone(),
                        namespace: ctx.internal.namespace.clone(),
                        locale: ctx.request.locale.key.to_string(),
                        model,
                        fields: Some(fields),
                        filter: None,
                        limit: Some(limit),
                        offset: Some(offset),
                        count: true,
                    }
                    .get(),
                )
                .inspect_err(|e| match e {
                    RenderError::Database(e) => {
                        log::error!("Database error occurred during rendering, {e:?}")
                    }
                    RenderError::Pool(e) => {
                        log::error!("Pool error occurred during rendering, {e:?}")
                    }
                })
                .map(|values| {
                    values.map(|(values, total_items)| {
                        let total_items = total_items.unwrap_or(0);
                        let total_pages = (total_items as f64 / per_page as f64).ceil() as i64;

                        Value::from_dyn_object(Arc::new(context::Pagination {
                            per_page,
                            current_page: page,
                            total_pages,
                            total_items,
                            items: values.into(),
                        }))
                    })
                })
                .map_err(|_| Error::new(ErrorKind::InvalidOperation, "RenderError"))
            },
        );
    }

    {
        let pool = pool.clone();

        env.add_function(
            "get_contents",
            move |state: &State, model: String, fields: Vec<String>, args: Kwargs| {
                let ctx: Arc<Context> = state
                    .lookup("ctx")
                    .expect("could not find render context")
                    .downcast_object()
                    .expect("context does not have expected type");

                let limit: Option<i64> = args.get("limit")?;
                let offset: Option<i64> = args.get("offset")?;

                let filter: Option<Vec<String>> = args.get("filter")?;

                if filter.is_none() && args.has("filter") {
                    return Err(Error::new(
                        ErrorKind::InvalidOperation,
                        "invalid parameters",
                    ));
                }

                block_on(
                    ContentSource {
                        pool: pool.clone(),
                        namespace: ctx.internal.namespace.clone(),
                        locale: ctx.request.locale.key.to_string(),
                        model,
                        fields: Some(fields),
                        filter: None,
                        limit,
                        offset,
                        count: false,
                    }
                    .get(),
                )
                .inspect_err(|e| match e {
                    RenderError::Database(e) => {
                        log::error!("Database error occurred during rendering, {e:?}")
                    }
                    RenderError::Pool(e) => {
                        log::error!("Pool error occurred during rendering, {e:?}")
                    }
                })
                .map(|values| values.map(|v| v.0))
                .map_err(|_| Error::new(ErrorKind::InvalidOperation, "RenderError"))
            },
        );
    }
}

fn string_to_value(kind: &str, value: String) -> Value {
    match kind {
        "string" => Value::from(value),
        "asset" => Value::from(value),
        "int" => Value::from(str::parse::<i64>(&value).unwrap_or(0)),
        unknown => {
            log::error!("Unhandled field kind is found, {unknown}");

            Value::from(value)
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

struct ContentSource {
    pool: Pool,
    namespace: String,
    locale: String,
    model: String,
    fields: Option<Vec<String>>,
    filter: Option<(String, String)>,
    limit: Option<i64>,
    offset: Option<i64>,
    count: bool,
}

impl ContentSource {
    async fn get(self) -> Result<Option<(Vec<Value>, Option<i64>)>, RenderError> {
        use diesel::prelude::*;
        use diesel_async::RunQueryDsl;

        let mut conn = self.pool.get().await.map_err(RenderError::Pool)?;

        let Some(model_id) = models::table
            .filter(
                models::key.eq(&self.model).and(
                    models::namespace
                        .is_null()
                        .or(models::namespace.eq(self.namespace)),
                ),
            )
            .select(models::id)
            .first::<i32>(&mut conn)
            .await
            .optional()
            .map_err(RenderError::Database)?
        else {
            log::debug!("Could not find model {}", self.model);

            return Ok(None);
        };

        let mfs_query = model_fields::table
            .inner_join(fields::table)
            .filter(model_fields::model_id.eq(model_id))
            .select((
                model_fields::id,
                model_fields::key,
                model_fields::multiple,
                fields::kind,
            ));

        let model_fields: Vec<(i32, String, bool, String)> = if let Some(f) = &self.fields {
            mfs_query
                .filter(model_fields::key.eq_any(f))
                .load(&mut conn)
        } else {
            mfs_query.load(&mut conn)
        }
        .await
        .map_err(RenderError::Database)?;

        let contents_query = contents::table
            .filter(
                contents::model_id
                    .eq(model_id)
                    .and(contents::stage.eq(ContentStage::Published)),
            )
            .order(contents::id.asc())
            .select(contents::id);

        let mut contents_query = if let Some(filter) = self.filter {
            if filter.0 == "id" {
                let Ok(id) = str::parse::<i32>(&filter.1) else {
                    log::debug!("Could not parse value as integer, filtering \"id\" requires value to be a string containing an integer");

                    return Ok(None);
                };

                contents_query.filter(contents::id.eq(id)).into_boxed()
            } else {
                contents_query
                    .filter(
                        contents::id.eq_any(
                            content_values::table
                                .inner_join(model_fields::table)
                                .filter(
                                    model_fields::model_id
                                        .eq(model_id)
                                        .and(model_fields::key.eq(filter.0)),
                                )
                                .filter(
                                    content_values::value.eq(filter.1).and(
                                        content_values::locale
                                            .eq(&self.locale)
                                            .or(content_values::locale.is_null()),
                                    ),
                                )
                                .select(content_values::content_id),
                        ),
                    )
                    .into_boxed()
            }
        } else {
            contents_query.into_boxed()
        };

        if let Some(limit) = self.limit {
            contents_query = contents_query.limit(limit);
        }

        if let Some(offset) = self.offset {
            contents_query = contents_query.offset(offset);
        }

        let (content_ids, total) = if self.count {
            let content_ids = contents_query
                .select((contents::id, base::paginate::CountStarOver))
                .load::<(i32, i64)>(&mut conn)
                .await
                .map_err(RenderError::Database)?;

            let total = content_ids.get(0).map(|x| x.1);

            (content_ids.into_iter().map(|x| x.0).collect(), total)
        } else {
            (
                contents_query
                    .select(contents::id)
                    .load::<i32>(&mut conn)
                    .await
                    .map_err(RenderError::Database)?,
                None,
            )
        };

        let mut content_values = content_values::table
            .filter(content_values::content_id.eq_any(&content_ids))
            .filter(
                content_values::model_field_id
                    .eq_any(model_fields.iter().map(|mf| mf.0).collect::<Vec<i32>>()),
            )
            .filter(
                content_values::locale
                    .eq(&self.locale)
                    .or(content_values::locale.is_null()),
            )
            .order((content_values::content_id.asc(), content_values::id.asc()))
            .select((
                content_values::content_id,
                content_values::model_field_id,
                content_values::value,
            ))
            .load::<(i32, i32, String)>(&mut conn)
            .await
            .map_err(RenderError::Database)?;

        let contents = content_ids
            .into_iter()
            .map(|id| {
                let mut content =
                    BTreeMap::<String, Value>::from_iter([("id".to_string(), Value::from(id))]);

                let mut values = content_values
                    .extract_if(.., |v| v.0 == id)
                    .collect::<Vec<_>>();

                for model_field in model_fields.iter() {
                    let mut values = values.extract_if(.., |v| v.1 == model_field.0);

                    let value = if model_field.2 {
                        Some(Value::from(
                            values
                                .map(|v| string_to_value(model_field.3.as_str(), v.2))
                                .collect::<Vec<_>>(),
                        ))
                    } else {
                        values
                            .next()
                            .map(|v| Value::from(string_to_value(model_field.3.as_str(), v.2)))
                    };

                    if let Some(value) = value {
                        content.insert(model_field.1.clone(), value);
                    }
                }

                Value::from(content)
            })
            .collect();

        Ok(Some((contents, total)))
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
