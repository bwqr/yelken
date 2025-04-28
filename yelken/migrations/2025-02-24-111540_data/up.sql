insert into locales (key, name) values ('en', 'English');

insert into options (name, value) values ('theme', 'yelken.default'), ('default_locale', 'en');

insert into fields (name, kind) values ('text', 'string'), ('integer', 'int');

insert into pages (name, path, template) values ('home', '/', 'index.html');
