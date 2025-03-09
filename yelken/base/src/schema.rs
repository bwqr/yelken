// @generated automatically by Diesel CLI.

diesel::table! {
    content_values (id) {
        id -> Int4,
        content_id -> Int4,
        model_field_id -> Int4,
        #[max_length = 8]
        locale -> Nullable<Varchar>,
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
    enum_options (id) {
        id -> Int4,
        field_id -> Int4,
        #[max_length = 255]
        value -> Varchar,
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
    locales (key) {
        #[max_length = 8]
        key -> Varchar,
        #[max_length = 64]
        name -> Varchar,
    }
}

diesel::table! {
    model_fields (id) {
        id -> Int4,
        field_id -> Int4,
        model_id -> Int4,
        localized -> Bool,
        multiple -> Bool,
        #[max_length = 255]
        name -> Varchar,
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
        #[max_length = 255]
        path -> Varchar,
        #[max_length = 255]
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
diesel::joinable!(content_values -> locales (locale));
diesel::joinable!(content_values -> model_fields (model_field_id));
diesel::joinable!(contents -> models (model_id));
diesel::joinable!(enum_options -> fields (field_id));
diesel::joinable!(model_fields -> fields (field_id));
diesel::joinable!(model_fields -> models (model_id));

diesel::allow_tables_to_appear_in_same_query!(
    content_values,
    contents,
    enum_options,
    fields,
    locales,
    model_fields,
    models,
    pages,
    plugins,
    users,
);
