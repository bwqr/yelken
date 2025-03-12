create function update_timestamp() returns trigger as $$
begin
    new.updated_at = now()::timestamptz(3);
    return new;
end;
$$ language plpgsql;

create table plugins(
    id         varchar(255) primary key not null,
    version    varchar(32)  not null,
    enabled    boolean      not null default true,
    name       varchar(255) not null,
    "desc"     text         not null,
    created_at timestamp    not null default current_timestamp
);

create table users(
    id         serial  primary key  not null,
    username   varchar(255)    not null unique,
    name       varchar(255)    not null,
    email      varchar(255)    not null unique,
    password   varchar(88)     not null,
    salt       varchar(32)     not null,
    created_at timestamp       not null default current_timestamp
);

create table locales(
    key  varchar(8) primary key not null,
    name varchar(64) not null
);

create table fields(
    id   serial primary key not null,
    name varchar(128)   not null,
    kind varchar(16)    not null
);

create table enum_options(
    id       serial primary key not null,
    field_id int          not null,
    value    varchar(255) not null,
    constraint fk_enum_options_field_id foreign key (field_id) references fields (id) on delete no action on update no action
);

create table models(
    id   serial primary key  not null,
    name varchar(128) unique not null
);

create table model_fields(
    id        serial primary key not null,
    field_id  int not null,
    model_id  int not null,
    localized bool not null default false,
    multiple  bool not null default false,
    name      varchar(255) not null,
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
    value          text default null,
    constraint fk_content_values_content_id foreign key (content_id) references contents (id) on delete no action on update no action,
    constraint fk_content_values_model_field_id foreign key (model_field_id) references model_fields (id) on delete no action on update no action,
    constraint fk_content_values_locale foreign key (locale) references locales (key) on delete no action on update no action
);

create table pages(
    id         serial primary key not null,
    name       varchar(255) not null,
    path       varchar(255) not null,
    template   varchar(255) not null,
    locale     varchar(8)   default null,
    created_at timestamp    not null default current_timestamp,
    unique (name, locale),
    unique (path),
    constraint fk_pages_locale foreign key (locale) references locales (key) on delete no action on update no action
);
