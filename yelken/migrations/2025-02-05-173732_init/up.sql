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
