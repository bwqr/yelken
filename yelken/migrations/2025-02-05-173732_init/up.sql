create function update_timestamp() returns trigger as $$
begin
    new.updated_at = now()::timestamptz(3);
    return new;
end;
$$ language plpgsql;

create table plugins(
    id          varchar(255) primary key not null,
    version     varchar(32)  not null,
    enabled     boolean      not null default true,
    name        varchar(255) not null,
    "desc"      text         not null,
    created_at  timestamp    not null default current_timestamp
);

create table users(
    id          serial  primary key  not null,
    username    varchar(255)    not null unique,
    name        varchar(255)    not null,
    email       varchar(255)    not null unique,
    password    varchar(88)     not null,
    salt        varchar(32)     not null,
    created_at  timestamp       not null default current_timestamp
);

create table fields(
    id   serial primary key not null,
    name varchar(128)   not null,
    kind varchar(16)    not null
);

create table models(
    id    serial primary key  not null,
    name  varchar(128) unique not null
);

create table model_fields(
    id       serial primary key not null,
    field_id int not null,
    model_id int not null,
    name     varchar(255) not null,
    constraint  fk_model_fields_field_id foreign key (field_id) references fields (id) on delete no action on update no action,
    constraint  fk_model_fields_model_id foreign key (model_id) references models (id) on delete no action on update no action
);

create table contents(
    id         serial primary key not null,
    model_id   int          not null,
    name       text         not null,
    created_at timestamp    not null default current_timestamp,
    constraint  fk_contents_model_id foreign key (model_id) references models (id) on delete no action on update no action
);

create table content_values(
    content_id     int not null,
    model_field_id int not null,
    value          text default null,
    primary key (content_id, model_field_id),
    constraint  fk_content_values_content_id foreign key (content_id) references contents (id) on delete no action on update no action,
    constraint  fk_content_values_model_field_id foreign key (model_field_id) references model_fields (id) on delete no action on update no action
);

create table pages(
    id         serial primary key not null,
    path       varchar(255) not null,
    template   varchar(255) not null,
    created_at timestamp    not null default current_timestamp
);
