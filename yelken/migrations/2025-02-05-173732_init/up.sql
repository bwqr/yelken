-- Your SQL goes here
create table plugins(
    id          serial primary key not null,
    name        varchar(255)       not null,
    created_at  timestamp          not null default current_timestamp
);
