use std::{collections::BTreeMap, sync::Arc};

use axum::{
    body::Body,
    extract::{Request, State},
    http::{self, StatusCode},
    response::{Html, IntoResponse, Response},
    Extension,
};
use base::{
    config::Options,
    models::Locale,
    responses::HttpError,
    schema::{locales, pages},
    AppState,
};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use matchit::{Match, Router};
use unic_langid::LanguageIdentifier;

use crate::render::Render;

pub mod page;
pub mod template;
pub mod theme;

fn resolve_locale<'a>(
    req: &'a Request,
    locales: impl Iterator<Item = &'a crate::render::context::Locale> + Clone,
    default: &'a crate::render::context::Locale,
) -> &'a crate::render::context::Locale {
    if locales.clone().next().is_none() {
        return default;
    }

    let path = req.uri().path();

    if !path.starts_with('/') {
        return default;
    }

    // Path based resolution
    let locale_segment = path.split_once('/').map(|split| split.1).unwrap();
    let locale_segment = locale_segment
        .split_once('/')
        .map(|split| split.0)
        .unwrap_or(locale_segment);

    if let Some(locale) = locales.clone().find(|l| &*l.key == locale_segment) {
        return locale;
    }

    // Cookie based resolution
    if let Some(cookie) = req
        .headers()
        .get(http::header::COOKIE)
        .and_then(|header| header.to_str().ok())
        .and_then(|cookie| cookie.split_once("yelken_locale=").map(|split| split.1))
    {
        let locale = cookie
            .split_once(';')
            .map(|split| split.0)
            .unwrap_or(cookie);

        if let Some(locale) = locales.clone().find(|l| &*l.key == locale) {
            return locale;
        }
    }

    // Header based resolution
    if let Some(accept_language) = req
        .headers()
        .get(http::header::ACCEPT_LANGUAGE)
        .and_then(|header| header.to_str().ok())
    {
        for lang in accept_language.split(',') {
            let lang = lang.split_once(';').map(|split| split.0).unwrap_or(lang);

            if let Some(locale) = locales.clone().find(|l| &*l.key == lang) {
                return locale;
            }
        }
    }

    default
}

pub async fn serve_page(
    State(state): State<AppState>,
    Extension(options): Extension<Options>,
    Extension(render): Extension<Render>,
    Extension(l10n): Extension<crate::L10n>,
    req: Request,
) -> Result<Response, HttpError> {
    if state.config.reload_templates {
        l10n.reload(
            &state.storage,
            &options.locale_locations(),
            &options.locales(),
            options.default_locale(),
        )
        .await;

        render
            .reload(&state.storage, &options.template_locations())
            .await
            .inspect_err(|e| log::warn!("Failed to refresh render {e:?}"))
            .map_err(|_| HttpError::internal_server_error("reload_templates_failed"))?;
    }

    let (locales, pages) = {
        let mut conn = state.pool.get().await?;

        let pages = pages::table
            .filter(
                pages::namespace
                    .is_null()
                    .or(pages::namespace.eq(&*options.theme())),
            )
            .select((pages::key, pages::path, pages::template, pages::locale))
            .load::<(String, String, String, Option<String>)>(&mut conn)
            .await?;

        let locales = locales::table
            .filter(locales::disabled.eq(false))
            .load::<Locale>(&mut conn)
            .await?
            .into_iter()
            .filter_map(|l| {
                let id = l.key.parse::<LanguageIdentifier>().ok()?;

                Some(Arc::new(crate::render::context::Locale {
                    id,
                    key: l.key.into(),
                    name: l.name.into(),
                }))
            })
            .collect::<Box<[_]>>();

        (locales, pages)
    };

    let default_locale = locales
        .iter()
        .find(|l| options.default_locale().matches(&l.id, true, true))
        .cloned()
        .unwrap_or_else(|| {
            Arc::new(crate::render::context::Locale {
                id: options.default_locale(),
                key: options.default_locale().to_string().into(),
                name: options.default_locale().to_string().into(),
            })
        });

    let current_locale = resolve_locale(&req, locales.iter().map(|l| &**l), &default_locale);

    let internal_ctx = crate::render::context::Internal {
        namespace: options.theme().to_string(),
        pages: pages
            .iter()
            .map(|p| crate::render::context::Page {
                key: p.0.clone(),
                path: p.1.clone(),
                locale: p.3.clone(),
            })
            .collect(),
        site_url: state.config.site_url.clone(),
    };
    let l10n_ctx = crate::render::context::L10n {
        locales: locales.clone(),
        default: Arc::clone(&default_locale),
    };

    let mut router = Router::new();

    let search_params = serde_urlencoded::de::from_str(req.uri().query().unwrap_or(""))
        .unwrap_or(BTreeMap::<String, String>::new());

    for (key, path, template, locale) in pages.into_iter() {
        let localized_path = match &locale {
            Some(locale) => {
                if locale == &*default_locale.key {
                    path.to_string()
                } else if path == "/" {
                    format!("/{locale}")
                } else {
                    format!("/{locale}{path}")
                }
            }
            _ => path.to_string(),
        };

        if let Err(e) = router.insert(localized_path, (key.clone(), template, locale)) {
            log::warn!("Failed to add path {path} of page {key} due to {e:?}");
        }
    }

    let Ok(Match {
        params,
        value: (key, template, page_locale),
    }) = router.at(req.uri().path())
    else {
        if let Some(redirect) = req
            .uri()
            .path()
            .strip_prefix('/')
            .and_then(|p| p.strip_prefix(&*default_locale.key))
        {
            if redirect.is_empty() || redirect.starts_with('/') {
                let mut url = state.config.site_url.clone();

                {
                    let mut segments = url.path_segments_mut().unwrap();

                    redirect
                        .split('/')
                        .filter(|path| !path.is_empty())
                        .for_each(|path| {
                            segments.push(path);
                        });
                }

                return Ok(Response::builder()
                    .status(StatusCode::TEMPORARY_REDIRECT)
                    .header(http::header::LOCATION, url.as_str())
                    .body(Body::empty())
                    .unwrap());
            }
        }

        let ctx = crate::render::context::Context::new(
            crate::render::context::Request {
                locale: Arc::new(current_locale.clone()),
                params: Arc::new(BTreeMap::new()),
                search_params: Arc::new(search_params),
            },
            l10n_ctx,
            internal_ctx,
        );

        let res = base::runtime::spawn_blocking(move || render.render("__404__.html", ctx))
            .await
            .unwrap();

        return match res {
            Ok((html, _)) => Ok((StatusCode::NOT_FOUND, Html(html)).into_response()),
            Err(e) => Ok((
                StatusCode::INTERNAL_SERVER_ERROR,
                Html(format!("Failed to render page, {e:?}")),
            )
                .into_response()),
        };
    };

    if let Some(page_locale) = &page_locale {
        let path = req.uri().path();

        let mut url = state.config.site_url.clone();

        {
            let mut path_segments = url.path_segments_mut().unwrap();
            path_segments.push(&current_locale.key);

            if !(path.is_empty() || path == "/") {
                path_segments.push(path);
            }
        }

        let localized_path = url.path();

        if page_locale != &*current_locale.key
            && router
                .at(localized_path)
                .map(|localized_route| localized_route.value.0 == *key)
                .unwrap_or(false)
        {
            return Ok(Response::builder()
                .status(StatusCode::TEMPORARY_REDIRECT)
                .header(http::header::LOCATION, localized_path)
                .body(Body::empty())
                .unwrap());
        }
    }

    // If page has a locale, overwrite the current locale
    let current_locale = page_locale
        .as_ref()
        .and_then(|pl| locales.iter().find(|l| &*l.key == pl).map(|l| l).cloned())
        .unwrap_or(Arc::new(current_locale.clone()));

    let ctx = crate::render::context::Context::new(
        crate::render::context::Request {
            locale: current_locale,
            params: Arc::new(BTreeMap::from_iter(
                params.iter().map(|(k, v)| (k.to_string(), v.to_string())),
            )),
            search_params: Arc::new(search_params),
        },
        l10n_ctx,
        internal_ctx,
    );

    let template = template.clone();

    let res = base::runtime::spawn_blocking(move || render.render(&template, ctx))
        .await
        .unwrap();

    match res {
        Ok((html, status)) => Ok((
            status
                .and_then(|s| StatusCode::from_u16(s).ok())
                .unwrap_or(StatusCode::OK),
            Html(html),
        )
            .into_response()),
        Err(e) => {
            log::info!("Could not render template: {:#}", e);

            let mut e = &e as &dyn std::error::Error;
            while let Some(next_err) = e.source() {
                log::info!("caused by: {:#}", next_err);
                e = next_err;
            }

            Ok((
                StatusCode::INTERNAL_SERVER_ERROR,
                Html(format!("Failed to render page,\n{e}")),
            )
                .into_response())
        }
    }
}

#[cfg(test)]
mod tests {
    use axum::{
        body::Body,
        extract::State,
        http::{self, Request, StatusCode},
        response::IntoResponse,
        Extension,
    };
    use base::{
        config::{Config, Options},
        db::Connection,
        schema::{locales, pages},
        test::{create_pool, DB_CONFIG},
        AppState,
    };
    use diesel::prelude::*;
    use diesel_async::RunQueryDsl;
    use unic_langid::LanguageIdentifier;

    use crate::{l10n::L10n, render::Render};

    use super::resolve_locale;

    async fn init_params(
        locales: &[&str],
        templates: Vec<(String, String)>,
    ) -> (AppState, Options, L10n, Render) {
        let service = opendal::services::Memory::default();
        let storage = opendal::Operator::new(service).unwrap().finish();

        for template in templates {
            storage
                .write(&format!("templates/{}", template.0), template.1)
                .await
                .unwrap();
        }

        let config = Config {
            env: "dev".to_string(),
            site_url: "http://127.0.0.1:3000".parse().unwrap(),
            app_url: "http://127.0.0.1:3000".parse().unwrap(),
            reload_templates: false,
        };
        let pool = create_pool(DB_CONFIG).await;
        let state = AppState::new(config, pool, storage.clone(), storage.clone());

        diesel::insert_into(locales::table)
            .values(
                locales
                    .into_iter()
                    .map(|locale| (locales::key.eq(locale), locales::name.eq(locale)))
                    .collect::<Vec<_>>(),
            )
            .execute(&mut state.pool.get().await.unwrap())
            .await
            .unwrap();

        let options = Options::new(
            "default".into(),
            locales.into_iter().map(|l| l.parse().unwrap()).collect(),
            "en".parse().unwrap(),
        );

        let l10n = L10n::new(
            &storage,
            &["locales".to_string()],
            &locales
                .into_iter()
                .map(|l| l.parse().unwrap())
                .collect::<Vec<_>>(),
            "en".parse().unwrap(),
        )
        .await;

        let renderer = Render::new(&storage, &["templates".to_string()], None)
            .await
            .unwrap();

        (state, options, l10n, renderer)
    }

    async fn create_pages(conn: &mut Connection, pages: &[(&str, &str, &str, Option<&str>)]) {
        diesel::insert_into(pages::table)
            .values(
                pages
                    .into_iter()
                    .map(|page| {
                        (
                            pages::name.eq(page.0),
                            pages::path.eq(page.1),
                            pages::template.eq(page.2),
                            pages::locale.eq(page.3),
                        )
                    })
                    .collect::<Vec<_>>(),
            )
            .execute(conn)
            .await
            .unwrap();
    }
    #[tokio::test]
    async fn it_returns_page_with_correct_locale() {
        let (state, options, l10n, renderer) = init_params(
            &["en", "tr"],
            vec![("contact.html".to_string(), "Contact Page".to_string())],
        )
        .await;

        create_pages(
            &mut state.pool.get().await.unwrap(),
            &[
                ("contact", "/contact", "contact.html", Some("en")),
                ("contact", "/iletisim", "contact.html", Some("tr")),
            ],
        )
        .await;

        let req = Request::builder()
            .uri("/tr/iletisim")
            .body(Body::empty())
            .unwrap();

        let resp = super::serve_page(
            State(state.clone()),
            Extension(options.clone()),
            Extension(renderer.clone()),
            Extension(l10n.clone()),
            req,
        )
        .await
        .unwrap()
        .into_response();

        assert_eq!(StatusCode::OK, resp.status());
    }

    #[tokio::test]
    async fn it_returns_307_when_two_pages_with_same_path_is_requested_and_user_has_non_default_locale(
    ) {
        let (state, options, l10n, renderer) =
            init_params(&["en", "tr"], vec![("".to_string(), "".to_string())]).await;

        create_pages(
            &mut state.pool.get().await.unwrap(),
            &[
                ("home", "/", "", Some("en")),
                ("home", "/", "", Some("tr")),
                ("test", "/test", "", Some("tr")),
            ],
        )
        .await;

        let cases = [
            ("/", StatusCode::TEMPORARY_REDIRECT, Some("/tr"), "tr"),
            ("/en", StatusCode::TEMPORARY_REDIRECT, Some("/"), "en"),
            (
                "/en/test",
                StatusCode::TEMPORARY_REDIRECT,
                Some("/test"),
                "en",
            ),
            ("/", StatusCode::OK, None, "en"),
            ("/tr/test", StatusCode::OK, None, "tr"),
        ];

        for (path, code, location, locale) in cases {
            let req = Request::builder()
                .uri(path)
                .header(http::header::COOKIE, format!("yelken_locale={locale}"))
                .body(Body::empty())
                .unwrap();

            let resp = super::serve_page(
                State(state.clone()),
                Extension(options.clone()),
                Extension(renderer.clone()),
                Extension(l10n.clone()),
                req,
            )
            .await
            .unwrap()
            .into_response();

            assert_eq!(code, resp.status());

            if let Some(location) = location {
                assert_eq!(
                    location,
                    resp.headers().get(http::header::LOCATION).unwrap()
                );
            }
        }
    }

    #[test]
    fn returns_default_when_no_locale_provided_or_path_not_start_with_slash() {
        // No locale case
        let default_locale = "en".parse().unwrap();

        assert_eq!(
            default_locale,
            *resolve_locale(&Request::new(Body::empty()), &[], &default_locale)
        );

        // Request that does not start with '/'
        assert_eq!(
            default_locale,
            *resolve_locale(
                &Request::builder()
                    .uri("not-slash")
                    .body(Body::empty())
                    .unwrap(),
                &["tr".parse().unwrap()],
                &default_locale
            )
        );
    }

    #[test]
    fn root_url_resolves_to_default_locale() {
        let default_locale = "en".parse().unwrap();
        let locales = ["tr".parse().unwrap()];
        let req = Request::builder().uri("/").body(Body::empty()).unwrap();

        let locale = resolve_locale(&req, &locales, &default_locale);

        assert_eq!(default_locale, *locale);
    }

    #[test]
    fn chooses_correct_locale_if_url_starts_with_locale() {
        let locales = ["en".parse().unwrap(), "tr".parse().unwrap()];

        let cases = [
            ("/en", "en"),
            ("/en-US", "en"),
            ("/tr/", "tr"),
            // Weird cases
            ("/tr-", "en"),
            ("/tr?test", "tr"),
            ("/tr/test", "tr"),
            // Unknown maps to default locale
            ("/es", "en"),
        ];

        for (path, expected_locale) in cases {
            let req = Request::builder().uri(path).body(Body::empty()).unwrap();

            let locale = resolve_locale(&req, &locales, &locales[0]);

            assert_eq!(expected_locale, locale.language.as_str());
        }
    }

    #[test]
    fn chooses_correct_locale_if_cookie_has_locale() {
        let locales = ["en".parse().unwrap(), "tr".parse().unwrap()];

        let cases = [
            ("/", "yelken_locale=en", "en"),
            ("/", "yelken_locale=tr", "tr"),
            ("/test", "yelken_locale=en", "en"),
            // Weird cases
            ("/", "test;yelken_locale=tr", "tr"),
            ("/", "test;yelken_locale=tr", "tr"),
            ("/", "test=test;yelken_locale=tr;key=val", "tr"),
            // Unknown maps to default locale
            ("/", "yelken_locale=es", "en"),
        ];

        for (path, cookie, expected_locale) in cases {
            let req = Request::builder()
                .uri(path)
                .header(http::header::COOKIE, cookie)
                .body(Body::empty())
                .unwrap();

            let locale = resolve_locale(&req, &locales, &locales[0]);

            assert_eq!(
                expected_locale.parse::<LanguageIdentifier>().unwrap(),
                *locale
            );
        }
    }

    #[test]
    fn chooses_correct_locale_if_accept_language_has_locale() {
        let locales = ["en".parse().unwrap(), "tr".parse().unwrap()];

        let cases = [
            ("/", "en,zh-CN", "en"),
            ("/", "tr,zh-CN", "tr"),
            // Weird cases
            ("/", "tr;q=0.4,zh-CN", "tr"),
            // Unknown maps to default locale
            ("/", "es", "en"),
        ];

        for (path, accept_language, expected_locale) in cases {
            let req = Request::builder()
                .uri(path)
                .header(http::header::ACCEPT_LANGUAGE, accept_language)
                .body(Body::empty())
                .unwrap();

            let locale = resolve_locale(&req, &locales, &locales[0]);

            assert_eq!(expected_locale, locale.language.as_str());
        }
    }
}
