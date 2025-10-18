use std::collections::HashMap;

use base::db::{BatchQuery, Connection};
use base::models::{ContentStage, Field, Locale, PageKind, Theme};
use base::schema::{
    content_values, contents, fields, locales, model_fields, models, namespaces, pages, themes,
};

use diesel::prelude::*;
use diesel::result::{DatabaseErrorKind, Error};
use diesel_async::{AsyncConnection, RunQueryDsl, scoped_futures::ScopedFutureExt};
use opendal::{EntryMode, Operator};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct ContentValue {
    field: String,
    value: String,
    locale: Option<String>,
}

#[derive(Debug, Deserialize)]
struct Content {
    name: String,
    model: String,
    values: Vec<ContentValue>,
}

#[derive(Debug, Deserialize)]
struct ModelField {
    field: String,
    key: String,
    name: String,
    desc: Option<String>,
    localized: Option<bool>,
    multiple: Option<bool>,
    required: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct Model {
    key: String,
    name: String,
    desc: Option<String>,
    fields: Vec<ModelField>,
}

#[derive(Debug, Deserialize)]
struct Page {
    key: String,
    name: String,
    desc: Option<String>,
    path: String,
    template: String,
    locale: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ThemeManifest {
    id: String,
    version: String,
    name: String,
    models: Vec<Model>,
    contents: Vec<Content>,
    pages: Vec<Page>,
}

pub async fn install_theme(
    conn: &mut Connection,
    src: &Operator,
    src_dir: &str,
    dst: &Operator,
    default_locale: String,
) -> Result<Theme, ()> {
    let manifest = src
        .read([src_dir, "Yelken.json"].join("/").as_str())
        .await
        .expect("Failed to read manifest file");

    let manifest =
        serde_json::from_reader::<_, ThemeManifest>(manifest).expect("Invalid manifest file");

    let theme_id = manifest.id.clone();

    let theme = conn
        .transaction(move |conn| {
            async move {
                QueryResult::<Theme>::Ok(
                    create_theme_resources(conn, manifest, default_locale)
                        .await
                        .expect("failed to create theme resources"),
                )
            }
            .scope_boxed()
        })
        .await
        .expect("Failed to create theme resources");

    for entry in src
        .list_with(src_dir)
        .recursive(true)
        .await
        .expect("Failed to list theme files")
    {
        let EntryMode::FILE = entry.metadata().mode() else {
            continue;
        };

        let file = src
            .read(entry.path())
            .await
            .expect("Failed to read theme file");

        dst.write(&["themes", &theme_id, entry.path()].join("/"), file)
            .await
            .expect("Failed to write theme file");
    }

    Ok(theme)
}

async fn create_theme_resources(
    conn: &mut Connection,
    manifest: ThemeManifest,
    default_locale: String,
) -> Result<Theme, &'static str> {
    let locales = locales::table
        .load::<Locale>(conn)
        .await
        .map_err(|_| "failed_loading_locales")?;

    let theme = diesel::insert_into(themes::table)
        .values((
            themes::id.eq(&manifest.id),
            themes::name.eq(&manifest.name),
            themes::version.eq(&manifest.version),
        ))
        .get_result::<Theme>(conn)
        .await
        .map_err(|e| {
            if let Error::DatabaseError(DatabaseErrorKind::UniqueViolation, _) = &e {
                return "theme_already_exists";
            }

            "failed_inserting_theme"
        })?;

    diesel::insert_into(namespaces::table)
        .values((
            namespaces::key.eq(&theme.id),
            namespaces::source.eq("theme"),
        ))
        .execute(conn)
        .await
        .map_err(|_| "failed_inserting_namespace")?;

    diesel::insert_into(pages::table)
        .values(
            manifest
                .pages
                .into_iter()
                .filter_map(|page| {
                    let locale = page.locale.and_then(|pl| {
                        if pl == "DEFAULT" {
                            Some(default_locale.clone())
                        } else {
                            locales.iter().any(|l| pl == l.key).then_some(pl)
                        }
                    })?;

                    Some((
                        pages::namespace.eq(manifest.id.clone()),
                        pages::key.eq(page.key),
                        pages::name.eq(page.name),
                        pages::desc.eq(page.desc),
                        pages::path.eq(page.path),
                        pages::kind.eq(PageKind::Template),
                        pages::value.eq(page.template),
                        pages::locale.eq(locale),
                    ))
                })
                .collect::<Vec<_>>(),
        )
        .batched()
        .execute(conn)
        .await
        .map_err(|_| "failed_inserting_pages")?;

    let models = HashMap::<String, base::models::Model>::from_iter(
        diesel::insert_into(models::table)
            .values(
                manifest
                    .models
                    .iter()
                    .map(|model| {
                        (
                            models::namespace.eq(manifest.id.clone()),
                            models::key.eq(model.key.clone()),
                            models::name.eq(model.name.clone()),
                            models::desc.eq(model.desc.clone()),
                        )
                    })
                    .collect::<Vec<_>>(),
            )
            .batched()
            .get_results::<base::models::Model>(conn)
            .await
            .map_err(|_| "failed_inserting_models")?
            .into_iter()
            .map(|model| (model.key.clone(), model)),
    );

    let fields = HashMap::<String, Field>::from_iter(
        fields::table
            .load::<Field>(conn)
            .await
            .map_err(|_| "failed_loading_fields")?
            .into_iter()
            .map(|field| (field.key.clone(), field)),
    );

    for model in manifest.models {
        let model_id = models.get(&model.key).ok_or("unreachable")?.id;

        let model_fields = model
            .fields
            .iter()
            .map(|model_field| {
                fields
                    .get(&model_field.field)
                    .map(|f| (f.id, model_field))
                    .ok_or_else(|| "unknown_field")
            })
            .collect::<Result<Vec<(i32, &ModelField)>, &'static str>>()?;

        let model_fields = HashMap::<String, base::models::ModelField>::from_iter(
            diesel::insert_into(model_fields::table)
                .values(
                    model_fields
                        .iter()
                        .map(|model_field| {
                            (
                                model_fields::model_id.eq(model_id),
                                model_fields::field_id.eq(model_field.0),
                                model_fields::key.eq(model_field.1.key.clone()),
                                model_fields::name.eq(model_field.1.name.clone()),
                                model_fields::desc.eq(model_field.1.desc.clone()),
                                model_fields::localized
                                    .eq(model_field.1.localized.unwrap_or(false)),
                                model_fields::multiple.eq(model_field.1.multiple.unwrap_or(false)),
                                model_fields::required.eq(model_field.1.required.unwrap_or(false)),
                            )
                        })
                        .collect::<Vec<_>>(),
                )
                .batched()
                .get_results::<base::models::ModelField>(conn)
                .await
                .map_err(|_| "failed_inserting_model_fields")?
                .into_iter()
                .map(|mf| (mf.key.clone(), mf)),
        );

        for content in manifest.contents.iter().filter(|c| c.model == model.key) {
            let values = content
                .values
                .iter()
                .map(|v| {
                    model_fields
                        .get(&v.field)
                        .map(|mf| (mf.id, v))
                        .ok_or_else(|| "unknown_field")
                })
                .collect::<Result<Vec<(i32, &ContentValue)>, &'static str>>()?;

            let content_id = diesel::insert_into(contents::table)
                .values((
                    contents::model_id.eq(model_id),
                    contents::name.eq(&content.name),
                    contents::stage.eq(ContentStage::Published),
                ))
                .get_result::<base::models::Content>(conn)
                .await
                .map_err(|_| "failed_inserting_contents")?
                .id;

            diesel::insert_into(content_values::table)
                .values(
                    values
                        .into_iter()
                        .filter_map(|v| {
                            let locale = v.1.locale.as_ref().and_then(|cl| {
                                if cl == "DEFAULT" {
                                    Some(default_locale.clone())
                                } else {
                                    locales.iter().any(|l| *cl == l.key).then(|| cl.clone())
                                }
                            })?;

                            Some((
                                content_values::content_id.eq(content_id),
                                content_values::model_field_id.eq(v.0),
                                content_values::value.eq(v.1.value.clone()),
                                content_values::locale.eq(locale),
                            ))
                        })
                        .collect::<Vec<_>>(),
                )
                .batched()
                .execute(conn)
                .await
                .map_err(|_| "failed_inserting_content_values")?;
        }
    }

    Ok(theme)
}
