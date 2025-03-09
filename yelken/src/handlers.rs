use std::{
    collections::{BTreeMap, HashMap},
    sync::Arc,
};

use axum::{
    extract::{Request, State},
    http::StatusCode,
    response::Html,
    Extension,
};
use base::{
    models::HttpError,
    schema::{
        content_values, contents, enum_options, fields, locales, model_fields, models, pages,
    },
    types::Pool,
    AppState,
};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use matchit::{Match, Router};
use plugin::PluginHost;
use serde::de::DeserializeOwned;
use tera::{from_value, to_value, Tera, Value};

pub async fn default_handler(
    State(state): State<AppState>,
    Extension(plugin_host): Extension<PluginHost>,
    req: Request,
) -> Result<(StatusCode, Html<String>), HttpError> {
    let url = req
        .uri()
        .path_and_query()
        .map(|pq| pq.as_str())
        .unwrap_or("/");

    let (locales, pages) = {
        let mut conn = state.pool.get().await?;

        let locales = locales::table
            .select((locales::key, locales::name))
            .load::<(String, String)>(&mut conn)
            .await?;

        let pages = pages::table
            .select((pages::id, pages::path, pages::template))
            .load::<(i32, String, String)>(&mut conn)
            .await?;

        (locales, pages)
    };

    let current_locale: Arc<str> = locales
        .get(0)
        .map(|locale| locale.0.clone())
        .unwrap_or("".to_string())
        .into();

    let mut router = Router::new();

    pages.into_iter().for_each(|(id, path, template)| {
        if let Err(e) = router.insert(&path, template) {
            log::warn!("Failed to add path {path} of page {id} due to {e:?}");
        }
    });

    let mut renderer = Tera::new(&format!(
        "{}/themes/{}/**/*.html",
        state.config.storage_dir, state.config.theme,
    ))
    .inspect_err(|e| log::warn!("Failed to parse templates, {e:?}"))
    .map_err(|_| HttpError::internal_server_error("failed_parsing_templates"))?;

    let mut context = tera::Context::new();
    context.insert(
        "locales",
        &HashMap::<String, String>::from_iter(locales.into_iter()),
    );
    context.insert("locale", &current_locale);

    let Ok(Match {
        params,
        value: template,
    }) = router.at(url)
    else {
        let not_found = renderer
            .render("__404__.html", &tera::Context::new())
            .inspect_err(|e| log::warn!("Failed to parse templates, {e:?}"))
            .map_err(|_| HttpError::internal_server_error("failed_parsing_templates"))?;

        return Ok((StatusCode::NOT_FOUND, Html(not_found)));
    };

    let params: HashMap<String, String> =
        HashMap::from_iter(params.iter().map(|(k, v)| (k.to_string(), v.to_string())));
    let template = template.clone();

    build_renderer(
        &mut renderer,
        current_locale,
        params,
        state.pool.clone(),
        plugin_host,
    )
    .inspect_err(|e| log::warn!("Failed to build renderer, {e:?}"))
    .map_err(|_| HttpError::internal_server_error("failed_building_renderer"))?;

    let res = tokio::runtime::Handle::current()
        .spawn_blocking(move || renderer.render(&template, &context))
        .await
        .unwrap();

    match res {
        Ok(html) => Ok((StatusCode::OK, Html(html))),
        Err(e) => Ok((
            StatusCode::INTERNAL_SERVER_ERROR,
            Html(format!("Failed to render page, {e:?}")),
        )),
    }
}

fn get_value<T: DeserializeOwned>(args: &HashMap<String, Value>, k: &str) -> Option<T> {
    args.get(k).cloned().and_then(|v| from_value::<T>(v).ok())
}

fn build_renderer(
    renderer: &mut Tera,
    current_locale: Arc<str>,
    params: HashMap<String, String>,
    pool: Pool,
    plugin_host: PluginHost,
) -> Result<(), &'static str> {
    renderer.register_function(
        "localize_url",
        move |args: &HashMap<String, Value>| -> tera::Result<Value> {
            let Some(path) = get_value::<String>(args, "path") else {
                return Err("invalid args".into());
            };

            Ok(to_value(path).unwrap())
        },
    );

    renderer.register_function(
        "localize",
        move |args: &HashMap<String, Value>| -> tera::Result<Value> {
            let Some(key) = get_value::<String>(args, "key") else {
                return Err("invalid args".into());
            };

            Ok(to_value(key).unwrap())
        },
    );

    renderer.register_function(
        "asset_url",
        move |args: &HashMap<String, Value>| -> tera::Result<Value> {
            let Some(path) = get_value::<String>(args, "path") else {
                return Err("invalid args".into());
            };

            let kind = get_value::<String>(args, "kind").unwrap_or_else(|| "static".to_string());

            match kind.as_ref() {
                "static" => Ok(to_value(format!("/assets/static/{path}")).unwrap()),
                "content" => Ok(to_value(format!("/assets/content/{path}")).unwrap()),
                _ => Err("unhandled asset kind".into()),
            }
        },
    );

    renderer.register_function(
        "url_param",
        move |args: &HashMap<String, Value>| -> tera::Result<Value> {
            let Some(param) = get_value::<String>(args, "param") else {
                return Err("invalid args".into());
            };

            Ok(to_value(params.get(&param)).unwrap())
        },
    );

    {
        let pool = pool.clone();
        let current_locale = current_locale.clone();

        renderer.register_function(
            "get_content",
            move |args: &HashMap<String, Value>| -> tera::Result<Value> {
                let get_string = |k: &str| get_value::<String>(args, k);

                let (model, field, value) = match (
                    get_string("model"),
                    get_string("field"),
                    get_string("value"),
                ) {
                    (Some(model), Some(field), Some(value)) => (model, field, value),
                    _ => return Err("invalid args".into()),
                };

                let locale =
                    get_value::<Arc<str>>(args, "locale").unwrap_or(current_locale.clone());

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
                                    .eq(&*locale)
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

        renderer.register_function(
            "get_contents",
            move |args: &HashMap<String, Value>| -> tera::Result<Value> {
                let (model, fields) = match (
                    get_value::<String>(args, "model"),
                    get_value::<Vec<String>>(args, "fields"),
                ) {
                    (Some(model), Some(fields)) => (model, fields),
                    _ => return Err("invalid args".into()),
                };

                let locale =
                    get_value::<Arc<str>>(args, "locale").unwrap_or(current_locale.clone());
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
                                        .eq(&*locale)
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
                                        .eq(&*locale)
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

    renderer.register_function(
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

    {
        renderer.register_function(
            "call_plugin",
            move |args: &HashMap<String, Value>| -> tera::Result<Value> {
                let (plugin, fn_id, opts) = match (
                    get_value::<String>(args, "plugin"),
                    get_value::<String>(args, "fn_id"),
                    get_value::<Vec<String>>(args, "opts"),
                ) {
                    (Some(plugin), Some(fn_id), Some(opts)) => (plugin, fn_id, opts),
                    _ => return Err("invalid args".into()),
                };

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

    Ok(())
}
