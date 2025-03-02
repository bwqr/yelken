insert into plugins (id, version, enabled, name, "desc") values ('yelken.editor', '0.1.0', true, 'Editor', 'Edit your posts');

insert into fields (id, name, kind) values (1, 'text', 'string'), (2, 'multiline text', 'string'), (3, 'date', 'date');

insert into models (id, name) values (1, 'article');

insert into model_fields (field_id, model_id, name) values (1, 1, 'title'), (2, 1, 'content'), (1, 1, 'slug');

insert into contents (id, model_id, name) values (1, 1, 'good days');

insert into content_values (content_id, model_field_id, value) values (1, 1, 'Good Old Days'), (1, 2, 'Such a good content'), (1, 3, 'article-test');

insert into pages (id, path, template) values (1, '/', 'index.html'), (2, '/article/{slug}', 'article.html');
