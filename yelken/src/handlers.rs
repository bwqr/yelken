use std::collections::HashMap;

use axum::{
    extract::{Request, State},
    http::{self, StatusCode},
    response::Html,
    Extension,
};
use base::{models::HttpError, schema::pages, AppState};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use matchit::{Match, Router};
use plugin::PluginHost;
use unic_langid::LanguageIdentifier;

use crate::{
    locale::Locale,
    render::{register_functions, Render},
};

pub async fn default_handler(
    State(state): State<AppState>,
    Extension(plugin_host): Extension<PluginHost>,
    Extension(l10n): Extension<Locale>,
    req: Request,
) -> Result<(StatusCode, Html<String>), HttpError> {
    let supported_locales = l10n.supported_locales();

    let (path, mut current_locale) = resolve_locale(&req, &supported_locales)
        .unwrap_or_else(|| (req.uri().path(), l10n.default_locale()));

    // Resolve current locale
    let mut router = Router::new();

    let pages = {
        let mut conn = state.pool.get().await?;

        let pages = pages::table
            .select((pages::id, pages::path, pages::template, pages::locale))
            .load::<(i32, String, String, Option<String>)>(&mut conn)
            .await?;

        pages
    };

    pages.into_iter().for_each(|(id, path, template, locale)| {
        if let Err(e) = router.insert(&path, (template, locale)) {
            log::warn!("Failed to add path {path} of page {id} due to {e:?}");
        }
    });

    let mut renderer = Render::new(&format!(
        "{}/themes/{}/**/*.html",
        state.config.storage_dir, state.config.theme,
    ))
    .inspect_err(|e| log::warn!("Failed to parse templates, {e:?}"))
    .map_err(|_| HttpError::internal_server_error("failed_parsing_templates"))?;

    let mut context = tera::Context::new();
    context.insert(
        "locales",
        &HashMap::<String, String>::from_iter(supported_locales.into_iter().map(|locale| {
            (
                locale.language.as_str().to_string(),
                locale.language.as_str().to_string(),
            )
        })),
    );

    context.insert("locale", &format!("{current_locale}"));

    let Ok(Match {
        params,
        value: (template, page_locale),
    }) = router.at(path)
    else {
        let not_found = renderer
            .render("__404__.html", &context)
            .inspect_err(|e| log::warn!("Failed to render 404 template, {e:?}"))
            .map_err(|_| HttpError::internal_server_error("failed_render_template"))?;

        return Ok((StatusCode::NOT_FOUND, Html(not_found)));
    };

    if let Some(page_locale) = page_locale {
        if let Some(locale) = supported_locales
            .iter()
            .find(|id| id.language.as_str() == page_locale)
        {
            current_locale = locale;
            context.insert("locale", &format!("{current_locale}"));
        }
    }

    let params: HashMap<String, String> =
        HashMap::from_iter(params.iter().map(|(k, v)| (k.to_string(), v.to_string())));
    let template = template.clone();

    register_functions(
        &mut renderer,
        l10n.clone(),
        current_locale.clone(),
        params,
        state.pool.clone(),
        plugin_host,
    );

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

fn match_route(pages: &[()]) -> Option<&str> {
    todo!()
}

fn resolve_locale<'a>(
    req: &'a Request,
    locales: &'a [LanguageIdentifier],
) -> Option<(&'a str, &'a LanguageIdentifier)> {
    if locales.len() == 0 {
        return None;
    }

    let path = req.uri().path();

    if !path.starts_with('/') {
        return None;
    }

    // Path based resolution
    let locale_segment = path.split_once('/').map(|split| split.1).unwrap();
    let locale_segment = locale_segment
        .split_once('/')
        .map(|split| split.0)
        .unwrap_or(locale_segment);

    if let Ok(locale) = locale_segment.parse::<LanguageIdentifier>() {
        if let Some(id) = locales.iter().find(|id| id.matches(&locale, true, true)) {
            // Strip the locale from path
            let path = path.get(locale_segment.len() + 1..).unwrap();

            let path = if path.is_empty() { "/" } else { path };

            return Some((path, id));
        }
    }

    // Cookie based resolution
    if let Some(cookie) = req
        .headers()
        .get(http::header::COOKIE)
        .and_then(|header| header.to_str().ok())
        .and_then(|cookie| cookie.split_once("yelken_locale=").map(|split| split.1))
    {
        let locale = cookie
            .split_once(";")
            .map(|split| split.0)
            .unwrap_or(cookie);

        if let Some(locale) = locales.iter().find(|id| locale == id.language.as_str()) {
            return Some((path, locale));
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

            if let Some(locale) = locales.iter().find(|id| lang == id.language.as_str()) {
                return Some((path, locale));
            }
        }
    }

    Some((path, &locales[0]))
}

#[cfg(test)]
mod tests {
    use axum::{
        body::Body,
        http::{self, Request},
    };

    use super::resolve_locale;

    #[test]
    fn returns_none_when_no_locale_provided_or_path_not_start_with_slash() {
        // No locale case
        assert!(resolve_locale(&Request::new(Body::empty()), &[]).is_none());

        // Request that does not start with '/'
        assert!(resolve_locale(
            &Request::builder()
                .uri("not-slash")
                .body(Body::empty())
                .unwrap(),
            &[]
        )
        .is_none());
    }

    #[test]
    fn root_url_resolves_to_default_locale() {
        let locales = ["en".parse().unwrap(), "tr".parse().unwrap()];
        let req = Request::builder().uri("/").body(Body::empty()).unwrap();

        let (url, locale) = resolve_locale(&req, &locales).unwrap();

        assert_eq!("/", url);
        assert_eq!("en", locale.language.as_str());
    }

    #[test]
    fn chooses_correct_locale_if_url_starts_with_locale() {
        let locales = ["en".parse().unwrap(), "tr".parse().unwrap()];

        let cases = [
            ("/en", "en", "/"),
            ("/en-US", "en", "/"),
            ("/tr/", "tr", "/"),
            // Weird cases
            ("/tr-", "en", "/tr-"),
            ("/tr?test", "tr", "/"),
            ("/tr/test", "tr", "/test"),
            // Unknown maps to default locale
            ("/es", "en", "/es"),
        ];

        for (path, expected_locale, expected_path) in cases {
            let req = Request::builder().uri(path).body(Body::empty()).unwrap();

            let (url, locale) = resolve_locale(&req, &locales).unwrap();

            assert_eq!(expected_path, url);
            assert_eq!(expected_locale, locale.language.as_str());
        }
    }

    #[test]
    fn chooses_correct_locale_if_cookie_has_locale() {
        let locales = ["en".parse().unwrap(), "tr".parse().unwrap()];

        let cases = [
            ("/", "yelken_locale=en", "en", "/"),
            ("/", "yelken_locale=tr", "tr", "/"),
            ("/test", "yelken_locale=en", "en", "/test"),
            // Weird cases
            ("/", "test;yelken_locale=tr", "tr", "/"),
            ("/", "test;yelken_locale=tr", "tr", "/"),
            ("/", "test=test;yelken_locale=tr;key=val", "tr", "/"),
            // Unknown maps to default locale
            ("/", "yelken_locale=es", "en", "/"),
        ];

        for (path, cookie, expected_locale, expected_path) in cases {
            let req = Request::builder()
                .uri(path)
                .header(http::header::COOKIE, cookie)
                .body(Body::empty())
                .unwrap();

            let (url, locale) = resolve_locale(&req, &locales).unwrap();

            assert_eq!(expected_path, url);
            assert_eq!(expected_locale, locale.language.as_str());
        }
    }

    #[test]
    fn chooses_correct_locale_if_accept_language_has_locale() {
        let locales = ["en".parse().unwrap(), "tr".parse().unwrap()];

        let cases = [
            ("/", "en,zh-CN", "en", "/"),
            ("/", "tr,zh-CN", "tr", "/"),
            // Weird cases
            ("/", "tr;q=0.4,zh-CN", "tr", "/"),
            // Unknown maps to default locale
            ("/", "es", "en", "/"),
        ];

        for (path, accept_language, expected_locale, expected_path) in cases {
            let req = Request::builder()
                .uri(path)
                .header(http::header::ACCEPT_LANGUAGE, accept_language)
                .body(Body::empty())
                .unwrap();

            let (url, locale) = resolve_locale(&req, &locales).unwrap();

            assert_eq!(expected_path, url);
            assert_eq!(expected_locale, locale.language.as_str());
        }
    }
}
