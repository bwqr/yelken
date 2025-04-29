// @generated automatically by Diesel CLI.

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
        created_at -> Timestamp,
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
        localized -> Bool,
        multiple -> Bool,
        required -> Bool,
        #[max_length = 128]
        name -> Varchar,
    }
}

diesel::table! {
    models (id) {
        id -> Int4,
        #[max_length = 128]
        namespace -> Nullable<Varchar>,
        #[max_length = 128]
        name -> Varchar,
    }
}

diesel::table! {
    options (id) {
        id -> Int4,
        #[max_length = 128]
        namespace -> Nullable<Varchar>,
        #[max_length = 128]
        name -> Varchar,
        #[max_length = 128]
        value -> Varchar,
    }
}

diesel::table! {
    pages (id) {
        id -> Int4,
        #[max_length = 128]
        namespace -> Nullable<Varchar>,
        #[max_length = 128]
        name -> Varchar,
        #[max_length = 255]
        path -> Varchar,
        #[max_length = 128]
        template -> Varchar,
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
        name -> Varchar,
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
        #[max_length = 32]
        name -> Varchar,
        created_at -> Timestamp,
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

diesel::joinable!(content_values -> contents (content_id));
diesel::joinable!(content_values -> locales (locale));
diesel::joinable!(content_values -> model_fields (model_field_id));
diesel::joinable!(contents -> models (model_id));
diesel::joinable!(enum_options -> fields (field_id));
diesel::joinable!(model_fields -> fields (field_id));
diesel::joinable!(model_fields -> models (model_id));
diesel::joinable!(pages -> locales (locale));
diesel::joinable!(permissions -> roles (role_id));
diesel::joinable!(permissions -> users (user_id));
diesel::joinable!(users -> roles (role_id));

diesel::allow_tables_to_appear_in_same_query!(
    content_values,
    contents,
    enum_options,
    fields,
    form_submissions,
    locales,
    model_fields,
    models,
    options,
    pages,
    permissions,
    plugins,
    roles,
    themes,
    users,
);
