// @generated automatically by Diesel CLI.

diesel::table! {
    content_values (content_id, field_id) {
        content_id -> Int4,
        field_id -> Int4,
        value -> Nullable<Text>,
    }
}

diesel::table! {
    contents (id) {
        id -> Int4,
        model_id -> Int4,
        name -> Text,
        created_at -> Timestamp,
    }
}

diesel::table! {
    fields (id) {
        id -> Int4,
        #[max_length = 128]
        name -> Varchar,
        #[max_length = 16]
        kind -> Varchar,
    }
}

diesel::table! {
    model_fields (field_id, model_id) {
        field_id -> Int4,
        model_id -> Int4,
    }
}

diesel::table! {
    models (id) {
        id -> Int4,
        #[max_length = 128]
        name -> Varchar,
    }
}

diesel::table! {
    pages (id) {
        id -> Int4,
        paths -> Text,
        #[max_length = 256]
        template -> Varchar,
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

diesel::joinable!(content_values -> contents (content_id));
diesel::joinable!(content_values -> fields (field_id));
diesel::joinable!(contents -> models (model_id));
diesel::joinable!(model_fields -> fields (field_id));
diesel::joinable!(model_fields -> models (model_id));

diesel::allow_tables_to_appear_in_same_query!(
    content_values,
    contents,
    fields,
    model_fields,
    models,
    pages,
    plugins,
    users,
);
