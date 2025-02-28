// @generated automatically by Diesel CLI.

diesel::table! {
    contents (id) {
        id -> Int4,
        content -> Text,
        created_at -> Timestamp,
    }
}

diesel::table! {
    pages (id) {
        id -> Int4,
        paths -> Text,
        content -> Text,
        created_at -> Timestamp,
    }
}

diesel::table! {
    plugins (id) {
        #[max_length = 255]
        id -> Varchar,
        #[max_length = 32]
        version -> Varchar,
        enabled -> Bool,
        #[max_length = 255]
        name -> Varchar,
        desc -> Text,
        created_at -> Timestamp,
    }
}

diesel::table! {
    users (id) {
        id -> Int4,
        #[max_length = 255]
        username -> Varchar,
        #[max_length = 255]
        name -> Varchar,
        #[max_length = 255]
        email -> Varchar,
        #[max_length = 88]
        password -> Varchar,
        #[max_length = 32]
        salt -> Varchar,
        created_at -> Timestamp,
    }
}

diesel::allow_tables_to_appear_in_same_query!(
    contents,
    pages,
    plugins,
    users,
);
