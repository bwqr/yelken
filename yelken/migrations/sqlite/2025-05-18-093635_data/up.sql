insert into locales (key, name) values ('en', 'English'), ('tr', 'Türkçe');

insert into themes (id, version, name) values ('default', '0.1.0', 'Yelken Default Theme');

insert into options (name, value) values ('theme', 'default'), ('default_locale', 'en');

insert into fields (name, kind) values ('text', 'string'), ('integer', 'int');

insert into models (namespace, name) values ('default', 'article');
insert into model_fields (model_id, field_id, name, localized, required) values (1, 1, 'title', true, true), (1, 1, 'slug', true, false);

insert into pages (namespace, name, path, template, locale) values ('default', 'home', '/', 'index.html', 'en'), ('default', 'home', '/', 'index.html', 'tr');
insert into pages (namespace, name, path, template, locale) values ('default', 'article', '/article/{slug}', 'article.html', 'en'), ('default', 'article', '/makale/{slug}', 'article.html', 'tr');
