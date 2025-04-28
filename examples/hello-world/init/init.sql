-- initialize database
create function update_timestamp() returns trigger as $$
begin
    new.updated_at = now()::timestamptz(3);
    return new;
end;
$$ language plpgsql;

create table options(
    id        serial primary key not null,
    namespace varchar(128) default null,
    name      varchar(128) not null,
    value     varchar(128) not null
);

create table plugins(
    id         varchar(128) primary key not null,
    version    varchar(32)  not null,
    enabled    boolean      not null default true,
    name       varchar(128) not null,
    "desc"     text         not null,
    created_at timestamp    not null default current_timestamp
);

create table themes(
    id      varchar(128) primary key not null,
    version varchar(32)  not null,
    name    varchar(128) not null,
    created_at timestamp not null default current_timestamp
);

create table roles(
    id    serial primary key not null,
    name  varchar(32)        not null unique,
    created_at timestamp     not null default current_timestamp
);

create table users(
    id         serial  primary key not null,
    role_id    int             default null,
    username   varchar(128)    not null unique,
    name       varchar(128)    not null,
    email      varchar(128)    not null unique,
    password   varchar(128)    default null,
    login_kind varchar(16)     not null default 'email',
    state      varchar(8)      not null default 'enabled' check (state in ('enabled', 'disabled')),
    openid     varchar(32)     default null,
    created_at timestamp       not null default current_timestamp,
    constraint fk_users_role_id foreign key (role_id) references roles (id) on delete no action on update no action
);

create table permissions(
    id         serial  primary key not null,
    user_id    int default null,
    role_id    int default null,
    name       varchar(32) not null,
    created_at timestamp   not null default current_timestamp,
    constraint fk_permissions_user_id foreign key (user_id) references users (id) on delete no action on update no action,
    constraint fk_permissions_role_id foreign key (role_id) references roles (id) on delete no action on update no action
);

create table locales(
    key      varchar(8)  primary key not null,
    name     varchar(64) not null,
    disabled bool        not null default false
);

create table fields(
    id   serial primary key not null,
    name varchar(128)   not null,
    kind varchar(16)    not null
);

create table enum_options(
    id       serial primary key not null,
    field_id int          not null,
    value    varchar(128) not null,
    constraint fk_enum_options_field_id foreign key (field_id) references fields (id) on delete no action on update no action
);

create table models(
    id        serial primary key  not null,
    namespace varchar(128)  default null,
    name      varchar(128) not null
);

create table model_fields(
    id        serial primary key not null,
    field_id  int not null,
    model_id  int not null,
    localized bool not null default false,
    multiple  bool not null default false,
    name      varchar(128) not null,
    constraint fk_model_fields_field_id foreign key (field_id) references fields (id) on delete no action on update no action,
    constraint fk_model_fields_model_id foreign key (model_id) references models (id) on delete no action on update no action
);

create table contents(
    id         serial primary key not null,
    model_id   int          not null,
    name       text         not null,
    created_at timestamp    not null default current_timestamp,
    constraint fk_contents_model_id foreign key (model_id) references models (id) on delete no action on update no action
);

create table content_values(
    id             serial primary key not null,
    content_id     int not null,
    model_field_id int not null,
    locale         varchar(8) default null,
    value          text not null,
    constraint fk_content_values_content_id foreign key (content_id) references contents (id) on delete no action on update no action,
    constraint fk_content_values_model_field_id foreign key (model_field_id) references model_fields (id) on delete no action on update no action,
    constraint fk_content_values_locale foreign key (locale) references locales (key) on delete no action on update no action
);

create table pages(
    id         serial primary key not null,
    namespace  varchar(128)  default null,
    name       varchar(128) not null,
    path       varchar(255) not null,
    template   varchar(128) not null,
    locale     varchar(8)   default null,
    created_at timestamp    not null default current_timestamp,
    constraint fk_pages_locale foreign key (locale) references locales (key) on delete no action on update no action
);

create table form_submissions(
    id         serial primary key not null,
    name       varchar(128) not null,
    values     text         not null,
    created_at timestamp    not null default current_timestamp
);

-- insert some data
insert into locales (key, name) values ('en', 'English'), ('tr', 'Türkçe');

insert into fields (name, kind) values ('text', 'string');

insert into models (name) values ('article');

insert into model_fields (field_id, model_id, name, localized) values (1, 1, 'title', true), (1, 1, 'content', true), (1, 1, 'slug', true);

insert into contents (model_id, name) values (1, 'Hello World');

insert into contents (model_id, name) values (1, 'Nice Day');

insert into content_values (content_id, model_field_id, value, locale) values (1, 1, 'Hello World', 'en'), (1, 2, 'Content of the article', 'en'), (1, 3, 'hello-world', 'en');
insert into content_values (content_id, model_field_id, value, locale) values (1, 1, 'Merhaba Dünya', 'tr'), (1, 2, 'Makalenin içeriği', 'tr'), (1, 3, 'merhaba-dunya', 'tr');

insert into content_values (content_id, model_field_id, value, locale) values (2, 1, 'Nice Day', 'en'), (2, 2, 'Content of nice day article', 'en'), (2, 3, 'nice-day', 'en');
insert into content_values (content_id, model_field_id, value, locale) values (2, 1, 'Hoş Gün', 'tr'), (2, 2, 'Hoş gün makalesinin içeriği', 'tr'), (2, 3, 'hos-gun', 'tr');

insert into pages (name, path, template, locale) values ('home', '/', 'index.html', 'en'), ('article', '/article/{slug}', 'article.html', 'en');
insert into pages (name, path, template, locale) values ('home', '/', 'index.html', 'tr'), ('article', '/makale/{slug}', 'article.html', 'tr');
