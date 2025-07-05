// @generated automatically by Diesel CLI.

diesel::table! {
    assets (id) {
        id -> Int4,
        #[max_length = 128]
        name -> Varchar,
        #[max_length = 128]
        filename -> Varchar,
        #[max_length = 128]
        filetype -> Nullable<Varchar>,
        created_by -> Nullable<Int4>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    content_values (id) {
        id -> Int4,
        content_id -> Int4,
        model_field_id -> Int4,
        #[max_length = 8]
        locale -> Nullable<Varchar>,
        value -> Text,
    }
}

diesel::table! {
    contents (id) {
        id -> Int4,
        model_id -> Int4,
        name -> Text,
        #[max_length = 16]
        stage -> Varchar,
        created_by -> Nullable<Int4>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    enum_options (id) {
        id -> Int4,
        field_id -> Int4,
        #[max_length = 128]
        value -> Varchar,
    }
}

diesel::table! {
    fields (id) {
        id -> Int4,
        #[max_length = 128]
        key -> Varchar,
        #[max_length = 128]
        name -> Varchar,
        #[max_length = 16]
        kind -> Varchar,
    }
}

diesel::table! {
    form_submissions (id) {
        id -> Int4,
        #[max_length = 128]
        name -> Varchar,
        values -> Text,
        created_at -> Timestamp,
    }
}

diesel::table! {
    locales (key) {
        #[max_length = 8]
        key -> Varchar,
        #[max_length = 64]
        name -> Varchar,
        disabled -> Bool,
    }
}

diesel::table! {
    model_fields (id) {
        id -> Int4,
        field_id -> Int4,
        model_id -> Int4,
        #[max_length = 128]
        key -> Varchar,
        #[max_length = 128]
        name -> Varchar,
        desc -> Nullable<Text>,
        localized -> Bool,
        multiple -> Bool,
        required -> Bool,
    }
}

diesel::table! {
    models (id) {
        id -> Int4,
        #[max_length = 128]
        namespace -> Nullable<Varchar>,
        #[max_length = 128]
        key -> Varchar,
        #[max_length = 128]
        name -> Varchar,
        desc -> Nullable<Text>,
        created_at -> Timestamp,
    }
}

diesel::table! {
    namespaces (key) {
        #[max_length = 128]
        key -> Varchar,
        #[max_length = 16]
        source -> Varchar,
    }
}

diesel::table! {
    options (id) {
        id -> Int4,
        #[max_length = 128]
        namespace -> Nullable<Varchar>,
        #[max_length = 128]
        key -> Varchar,
        value -> Text,
    }
}

diesel::table! {
    pages (id) {
        id -> Int4,
        #[max_length = 128]
        namespace -> Nullable<Varchar>,
        #[max_length = 128]
        key -> Varchar,
        #[max_length = 128]
        name -> Varchar,
        desc -> Nullable<Text>,
        #[max_length = 255]
        path -> Varchar,
        #[max_length = 16]
        kind -> Varchar,
        #[max_length = 128]
        value -> Varchar,
        #[max_length = 8]
        locale -> Nullable<Varchar>,
        created_at -> Timestamp,
    }
}

diesel::table! {
    permissions (id) {
        id -> Int4,
        user_id -> Nullable<Int4>,
        role_id -> Nullable<Int4>,
        #[max_length = 32]
        key -> Varchar,
        created_at -> Timestamp,
    }
}

diesel::table! {
    plugins (id) {
        #[max_length = 128]
        id -> Varchar,
        #[max_length = 32]
        version -> Varchar,
        enabled -> Bool,
        #[max_length = 128]
        name -> Varchar,
        desc -> Text,
        created_at -> Timestamp,
    }
}

diesel::table! {
    roles (id) {
        id -> Int4,
        #[max_length = 128]
        key -> Varchar,
        #[max_length = 128]
        name -> Varchar,
        desc -> Nullable<Text>,
        created_at -> Timestamp,
    }
}

diesel::table! {
    tags (id) {
        id -> Int4,
        #[max_length = 16]
        resource -> Varchar,
        resource_id -> Int4,
        #[max_length = 128]
        key -> Varchar,
        value -> Nullable<Text>,
    }
}

diesel::table! {
    themes (id) {
        #[max_length = 128]
        id -> Varchar,
        #[max_length = 32]
        version -> Varchar,
        #[max_length = 128]
        name -> Varchar,
        created_at -> Timestamp,
    }
}

diesel::table! {
    users (id) {
        id -> Int4,
        role_id -> Nullable<Int4>,
        #[max_length = 128]
        username -> Varchar,
        #[max_length = 128]
        name -> Varchar,
        #[max_length = 128]
        email -> Varchar,
        #[max_length = 128]
        password -> Nullable<Varchar>,
        #[max_length = 16]
        login_kind -> Varchar,
        #[max_length = 8]
        state -> Varchar,
        #[max_length = 32]
        openid -> Nullable<Varchar>,
        created_at -> Timestamp,
    }
}

diesel::joinable!(assets -> users (created_by));
diesel::joinable!(content_values -> contents (content_id));
diesel::joinable!(content_values -> locales (locale));
diesel::joinable!(content_values -> model_fields (model_field_id));
diesel::joinable!(contents -> models (model_id));
diesel::joinable!(contents -> users (created_by));
diesel::joinable!(enum_options -> fields (field_id));
diesel::joinable!(model_fields -> fields (field_id));
diesel::joinable!(model_fields -> models (model_id));
diesel::joinable!(models -> namespaces (namespace));
diesel::joinable!(options -> namespaces (namespace));
diesel::joinable!(pages -> locales (locale));
diesel::joinable!(permissions -> roles (role_id));
diesel::joinable!(permissions -> users (user_id));
diesel::joinable!(users -> roles (role_id));

diesel::allow_tables_to_appear_in_same_query!(
    assets,
    content_values,
    contents,
    enum_options,
    fields,
    form_submissions,
    locales,
    model_fields,
    models,
    namespaces,
    options,
    pages,
    permissions,
    plugins,
    roles,
    tags,
    themes,
    users,
);
