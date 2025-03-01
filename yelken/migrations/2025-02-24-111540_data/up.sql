insert into plugins (id, version, enabled, name, "desc") values ('yelken.editor', '0.1.0', true, 'Editor', 'Edit your posts');

insert into fields (id, name, kind) values (1, 'title', 'string'), (2, 'content', 'string');

insert into models (id, name) values (1, 'article');

insert into model_fields (field_id, model_id) values (1, 1), (2, 1);

insert into contents (id, model_id, name) values (1, 1, 'good days');

insert into content_values (content_id, field_id, value) values (1, 1, 'Good Old Days'), (1, 2, 'Such a good content');

insert into pages (id, paths, template) values (1, '/', 'index.html');
