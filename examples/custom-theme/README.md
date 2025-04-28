## Yelken Theme Development Example

This example shows you how to develop a theme and install it into Yelken.
Before proceeding with the followings, please ensure that you have `docker-compose` installed and ready to be used on your machine.

To start the Yelken and run it on your machine, just execute the following command inside this directory:
```sh
docker-compose up
```

### Developing Theme

> Note: If you do not want to perform all these steps, you may also use the `theme` directory directly as it contains the final version of the theme developed at below.

Once Postgresql and Yelken boot up, we can start creating our theme. For this purpose, we will create an emptry directory named `my.theme`, which will be used for creating a theme archive.
Inside this directory, create a file called `Yelken.json` with following content:
```json
{
  "id": "my.theme",
  "version": "0.1.0",
  "name": "My Custom Theme",
  "models": [],
  "contents": [],
  "pages": []
}
```

This file, `Yelken.json`, contains the theme's manifest for Yelken to identify it and perform installation.
First of all, `id` defines the identity of the theme and must be unique, whereas `name` is pretty-print text and exists for displaying it to user.
There is also `version` that indicates the current version of the theme.
Other fields provide required models, contents and pages for theme to function.

Considering that a theme can have templates that require some specific kind of models to exist to display their contents, themes can provide `models` and `contents` in their manifest.
Additionally, themes can also denote which template should be rendered at which URL path by specifying them in `pages` field.

As an example, we will add a **menu** model by modifying `models` field with following content:
```json
"models": [
  {
    "name": "menu",
    "fields": [
      { "name": "name", "field": "text", "localized": true, "multiple": false },
      { "name": "path", "field": "text", "localized": true, "multiple": false }
    ]
  }
]
```

Additionally, we will insert a few **menu** contents to display them when user install the theme:
```json
"contents": [
  {
    "name": "Home",
    "model": "menu",
    "values": [
      { "field": "name", "value": "Home", "locale": "en"},
      { "field": "name", "value": "Ana Sayfa", "locale": "tr"},
      { "field": "path", "value": "/", "locale": "en"},
      { "field": "path", "value": "/", "locale": "tr"}
    ]
  },
  {
    "name": "About Me",
    "model": "menu",
    "values": [
      { "field": "name", "value": "About Me", "locale": "en"},
      { "field": "name", "value": "Hakkımda", "locale": "tr"},
      { "field": "path", "value": "/about-me", "locale": "en"},
      { "field": "path", "value": "/hakkimda", "locale": "tr"}
    ]
  }
]
```

Lastly, let us create `pages` to render corresponding template at paths specified by **menu** contents.

```json
"pages": [
  { "name": "home", "path": "/", "template": "home.html", "locale": "en" },
  { "name": "home", "path": "/", "template": "home.html", "locale": "tr" },
  { "name": "about-me", "path": "/about-me", "template": "about-me.html", "locale": "en" },
  { "name": "about-me", "path": "/hakkimda", "template": "about-me.html", "locale": "tr" }
]
```

After writing manifest file, we can now create locale and template files to complete the theme development.
Create three different template files located at `templates/base.html`, `templates/home.html` and `templates/about-me.html` inside the theme directory with following contents:
```html
<!-- base.html -->
<!DOCTYPE html>
<html>
  <head>
      <title>{% block title %}{{ localize("site-title") }}{% endblock title%}</title>
  </head>
  <body>
      <header>
          <h1>
              <a href="{{ localize_url(page='home') }}">{{ localize("site-title") }}</a>
          </h1>
          <nav>
              {% for menu in get_contents('menu', ['name', 'path']) %}
                  <a href="{{ localize_url(path=menu.path) }}">{{ menu.name }}</a>
              {% endfor %}
          </nav>

          <nav>
              {% for key, name in locale.all %}
                  <a href="{{ "/" ~ key }}" onclick="document.cookie = 'yelken_locale={{ key }}; SameSite=Strict; Path=/'">{{ key }}</a>
              {% endfor %}
          </nav>
      </header>

      <main>
          {%- block body %}{% endblock body -%}
      </main>
  </body>
</html>
```
```html
{% extends "base.html" %}
<!-- home.html -->

{% block body %}
    <p>{{ localize("welcome") }}</p>
{% endblock body %}
```
```html
{% extends "base.html" %}
<!-- about-me.html -->

{% block body %}
    <p>{{ localize("about-me") }}</p>
{% endblock body %}
```

To provide translations for static texts used in templates, create two files located at `locales/en.ftl` and `locales/tr.ftl` inside the theme directory with following contents:
```ftl
# en.ftl
site-title = Sail
welcome = Welcome to {site-title}
about-me = This page is about me
```
```ftl
# tr.ftl
site-title = Yelken
welcome = {site-title}'e Hoş Geldiniz
about-me = Bu sayfa benim hakkımda
```

### Creating Theme Archive

Now it is time to create the theme archive. A theme archive is basically a zip archive. You can create it with following command inside the theme directory:
```sh
zip -r ../theme.zip ./*
```

### Installing Theme
After that, we need to send it to running Yelken instance. However this requires authentication, so we will first login and obtain a token:
```sh
token=$(curl -X POST -H 'Content-Type: application/json' -d '{"email": "admin@yelken.com", "password": "Pass1234!"}' http://127.0.0.1:8080/api/auth/login | jq -r .token)
```

We can now send our theme archive:
```sh
curl -X POST -F theme=@../theme.zip -H "Authorization: Bearer $token" http://127.0.0.1:8080/api/admin/install/theme
```

Lastly, set our theme as active theme:
```sh
curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $token" -d '{"theme": "my.theme"}'  http://127.0.0.1:8080/api/admin/options/theme
```

### Testing Theme
You can now open [http://127.0.0.1:8080](http://127.0.0.1:8080) in your browser and see your theme.

### Uninstalling Theme
If you want to make some changes on your theme, you will first need to remove the theme and reinstall it.
To achieve that, set the active theme as the default theme:
```sh
curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $token" -d '{"theme": "yelken.default"}'  http://127.0.0.1:8080/api/admin/options/theme
```

Uninstall your theme:
```sh
curl -X DELETE -H "Authorization: Bearer $token" http://127.0.0.1:8080/api/admin/uninstall/theme/my.theme
```
