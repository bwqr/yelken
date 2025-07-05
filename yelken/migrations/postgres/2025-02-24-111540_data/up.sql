insert into namespaces (key, source) values ('default', 'theme');

insert into locales (key, name) values ('en', 'English'), ('tr', 'Türkçe');

insert into themes (id, version, name) values ('default', '0.1.0', 'Yelken Default Theme');

insert into options (key, value) values ('theme', 'default'), ('default_locale', 'en');

insert into fields (key, name, kind) values ('text', 'Text', 'string'), ('integer', 'Number', 'int'), ('asset', 'Asset', 'asset');

insert into models (namespace, key, name) values ('default', 'article', 'Article');
insert into model_fields (model_id, field_id, key, name, localized, required) values (1, 1, 'title', 'Title', true, true), (1, 1, 'content', 'Content', true, false), (1, 1, 'slug', 'Slug', true, false);

insert into pages (namespace, key, name, path, value, locale) values ('default', 'home', 'Home', '/', 'index.html', 'en'), ('default', 'home', 'Home', '/', 'index.html', 'tr');
insert into pages (namespace, key, name, path, value, locale) values ('default', 'article', 'Article', '/article/{slug}', 'article.html', 'en'), ('default', 'article', 'Article', '/makale/{slug}', 'article.html', 'tr');
