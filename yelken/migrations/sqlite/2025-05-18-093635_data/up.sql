insert into locales (key, name) values ('en', 'English'), ('tr', 'Türkçe');

insert into themes (id, version, name) values ('default', '0.1.0', 'Yelken Default Theme');

insert into options (name, value) values ('theme', 'default'), ('default_locale', 'en');

insert into fields (name, kind) values ('text', 'string'), ('integer', 'int'), ('asset', 'asset');

insert into models (namespace, name) values ('default', 'article');
insert into model_fields (model_id, field_id, name, localized, required) values (1, 1, 'title', true, true), (1, 1, 'content', true, false), (1, 1, 'slug', true, false);

insert into contents (model_id, name, stage) values (1, 'Hello World', 'published');
insert into contents (model_id, name, stage) values (1, 'Nice Day', 'published');

insert into content_values (content_id, model_field_id, value, locale) values (1, 1, 'Hello World', 'en'), (1, 2, 'Content of the article', 'en'), (1, 3, 'hello-world', 'en');
insert into content_values (content_id, model_field_id, value, locale) values (1, 1, 'Merhaba Dünya', 'tr'), (1, 2, 'Makalenin içeriği', 'tr'), (1, 3, 'merhaba-dunya', 'tr');

insert into content_values (content_id, model_field_id, value, locale) values (2, 1, 'Nice Day', 'en'), (2, 2, 'Content of nice day article', 'en'), (2, 3, 'nice-day', 'en');
insert into content_values (content_id, model_field_id, value, locale) values (2, 1, 'Hoş Gün', 'tr'), (2, 2, 'Hoş gün makalesinin içeriği', 'tr'), (2, 3, 'hos-gun', 'tr');

insert into pages (namespace, name, path, template, locale) values ('default', 'home', '/', 'index.html', 'en'), ('default', 'home', '/', 'index.html', 'tr');
insert into pages (namespace, name, path, template, locale) values ('default', 'article', '/article/{slug}', 'article.html', 'en'), ('default', 'article', '/makale/{slug}', 'article.html', 'tr');
