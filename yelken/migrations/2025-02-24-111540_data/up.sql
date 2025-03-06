insert into plugins (id, version, enabled, name, "desc") values ('yelken.editor', '0.1.0', true, 'Editor', 'Edit your posts');

insert into locales (key, name) values ('en', 'English'), ('tr', 'Türkçe');

insert into fields (name, kind) values ('text', 'string'), ('multiline text', 'string'), ('date', 'date');

insert into models (name) values ('article');

insert into model_fields (field_id, model_id, name) values (1, 1, 'title'), (2, 1, 'content'), (1, 1, 'slug');

insert into contents (model_id, name) values (1, 'good days');

insert into content_values (content_id, model_field_id, value) values (1, 1, 'Good Old Days'), (1, 2, 'Such a good content'), (1, 3, 'article-test');

insert into pages (path, template) values ('/', 'index.html'), ('/article/{slug}', 'article.html');
