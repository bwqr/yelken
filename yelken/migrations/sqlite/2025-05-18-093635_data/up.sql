insert into locales (key, name) values ('en', 'English'), ('tr', 'Türkçe');

insert into themes (id, version, name) values ('default', '0.1.0', 'Yelken Default Theme');

insert into options (key, value) values ('theme', 'default'), ('default_locale', 'en');

insert into fields (key, name, kind) values ('text', 'Text', 'string'), ('multiline', 'Multiline', 'multiline'), ('integer', 'Number', 'int'), ('asset', 'Asset', 'asset');

insert into models (namespace, key, name) values ('default', 'article', 'Article');
insert into model_fields (model_id, field_id, key, name, localized, required) values (1, 1, 'title', 'Title', true, true), (1, 1, 'content', 'Content', true, false), (1, 1, 'slug', 'Slug', true, false);

insert into contents (model_id, name, stage) values (1, 'Hello World', 'published');
insert into contents (model_id, name, stage) values (1, 'Nice Day', 'published');

insert into content_values (content_id, model_field_id, value, locale) values (1, 1, 'Hello World', 'en'), (1, 2, 'Content of the article', 'en'), (1, 3, 'hello-world', 'en');
insert into content_values (content_id, model_field_id, value, locale) values (1, 1, 'Merhaba Dünya', 'tr'), (1, 2, 'Makalenin içeriği', 'tr'), (1, 3, 'merhaba-dunya', 'tr');

insert into content_values (content_id, model_field_id, value, locale) values (2, 1, 'Nice Day', 'en'), (2, 2, 'Content of nice day article', 'en'), (2, 3, 'nice-day', 'en');
insert into content_values (content_id, model_field_id, value, locale) values (2, 1, 'Hoş Gün', 'tr'), (2, 2, 'Hoş gün makalesinin içeriği', 'tr'), (2, 3, 'hos-gun', 'tr');

insert into pages (namespace, key, name, path, value, locale) values ('default', 'home', 'Home', '/', 'index.html', 'en'), ('default', 'home', 'Home', '/', 'index.html', 'tr');
insert into pages (namespace, key, name, path, value, locale) values ('default', 'article', 'Article', '/article/{slug}', 'article.html', 'en'), ('default', 'article', 'Article', '/makale/{slug}', 'article.html', 'tr');
