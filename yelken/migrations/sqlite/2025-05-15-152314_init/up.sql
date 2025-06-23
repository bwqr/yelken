create table options(
    id        integer primary key autoincrement,
    namespace varchar(128) default null,
    key       varchar(128) not null,
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
    id         integer primary key autoincrement,
    key        varchar(128) not null unique,
    name       varchar(128) not null,
    "desc"     text         default null,
    created_at timestamp    not null default current_timestamp
);

create table users(
    id         integer primary key autoincrement,
    role_id    int             default null,
    username   varchar(128)    not null unique,
    name       varchar(128)    not null,
    email      varchar(128)    not null unique,
    password   varchar(128)    default null,
    login_kind varchar(16)     not null default 'email',
    state      varchar(8)      not null default 'enabled',
    openid     varchar(32)     default null,
    created_at timestamp       not null default current_timestamp,
    foreign key (role_id) references roles (id) on delete no action on update no action,
    check (state in ('enabled', 'disabled'))
);

create table permissions(
    id         integer primary key autoincrement,
    user_id    int default null,
    role_id    int default null,
    key        varchar(32) not null,
    created_at timestamp   not null default current_timestamp,
    foreign key (user_id) references users (id) on delete cascade on update no action,
    foreign key (role_id) references roles (id) on delete cascade on update no action
);

create table locales(
    key      varchar(8)  primary key not null,
    name     varchar(64) not null,
    disabled bool        not null default false
);

create table fields(
    id   integer primary key autoincrement,
    key  varchar(128)   not null unique,
    name varchar(128)   not null,
    kind varchar(16)    not null
);

create table enum_options(
    id       integer primary key autoincrement,
    field_id int          not null,
    value    varchar(128) not null,
    foreign key (field_id) references fields (id) on delete no action on update no action
);

create table assets(
    id         integer primary key autoincrement,
    name       varchar(128) not null,
    filename   varchar(128) not null unique,
    filetype   varchar(128) default null,
    created_by int          default null,
    created_at timestamp    not null default current_timestamp,
    updated_at timestamp    not null default current_timestamp,
    foreign key (created_by) references users (id) on delete set null on update no action
);

create trigger assets_updated_at update of name on assets
  for each row
  begin
    update assets set updated_at = current_timestamp where id = old.id;
  end;

create table models(
    id         integer primary key autoincrement,
    namespace  varchar(128) default null,
    key        varchar(128) not null,
    name       varchar(128) not null,
    "desc"     text         default null,
    created_at timestamp    not null default current_timestamp
);

create table model_fields(
    id        integer primary key autoincrement,
    field_id  int not null,
    model_id  int not null,
    key       varchar(128) not null,
    name      varchar(128) not null,
    "desc"    text         default null,
    localized bool         not null default false,
    multiple  bool         not null default false,
    required  bool         not null default false,
    unique (model_id, key),
    foreign key (field_id) references fields (id) on delete no action on update no action,
    foreign key (model_id) references models (id) on delete cascade on update no action
);

create table contents(
    id         integer primary key autoincrement,
    model_id   int          not null,
    name       text         not null,
    stage      varchar(16)  not null default 'draft',
    created_by int          default null,
    created_at timestamp    not null default current_timestamp,
    updated_at  timestamp   not null default current_timestamp,
    foreign key (model_id) references models (id) on delete no action on update no action,
    foreign key (created_by) references users (id) on delete no action on update no action,
    check (stage in ('published', 'draft'))
);

create trigger contents_updated_at update of name, stage on contents
  for each row
  begin
    update contents set updated_at = current_timestamp where id = old.id;
  end;

create table content_values(
    id             integer primary key autoincrement,
    content_id     int not null,
    model_field_id int not null,
    locale         varchar(8) default null,
    value          text not null,
    foreign key (content_id) references contents (id) on delete cascade on update no action,
    foreign key (model_field_id) references model_fields (id) on delete no action on update no action,
    foreign key (locale) references locales (key) on delete no action on update no action
);

create table pages(
    id         integer primary key autoincrement,
    namespace  varchar(128) default null,
    key        varchar(128) not null,
    name       varchar(128) not null,
    "desc"     text         default null,
    path       varchar(255) not null,
    template   varchar(128) not null,
    locale     varchar(8)   default null,
    created_at timestamp    not null default current_timestamp,
    foreign key (locale) references locales (key) on delete no action on update no action
);

create table form_submissions(
    id         integer primary key autoincrement,
    name       varchar(128) not null,
    `values`   text         not null,
    created_at timestamp    not null default current_timestamp
);
