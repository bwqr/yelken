create function update_timestamp() returns trigger as $$
begin
    new.updated_at = now()::timestamptz(3);
    return new;
end;
$$ language plpgsql;

create table plugins(
    id          serial primary key not null,
    name        varchar(255)       not null,
    created_at  timestamp          not null default current_timestamp
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
