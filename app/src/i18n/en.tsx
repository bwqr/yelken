import { A } from "@solidjs/router";
import { ColorMode } from "../theme";
import { ContentStage } from "../lib/cms/models";

export const auth = {
    login: {
        title: 'Log in to Yelken',
        subtitle: 'Log in to manage your website',
        slogan: 'Easy way to manage websites',
        login: 'Log in',
        email: 'Email',
        password: 'Password',
        validationErrors: {
            email: 'Please enter your email',
            password: 'Please enter your password',
        },
        serverErrors: {
            invalid_credentials: 'Invalid credentials',
            user_not_created_with_email: 'User has different login method',
        },
    }
};

export const app = {
    pageNotFound: () => (<>Page not found. Go to <A href="/">Home Page</A></>),
};

export const asset = {
    asset: 'Asset',
    actions: {
        pickAsset: 'Pick an Asset',
        uploadAsset: 'Upload Asset',
        chooseAsset: 'Choose an asset file',
        upload: 'Upload',
        assetUploaded: (name: string) => `Asset "${name}" is uploaded successfully`,
        assetUpdated: (name: string) => `Asset "${name}" is updated successfully`,
        assetDeleted: (name: string) => `Asset "${name}" is deleted successfully`,
        confirmDelete: (name: string) => (<>Are you sure about deleting the asset <strong>{name}</strong></>),
    },
    labels: {
        link: 'Link',
        type: 'Type',
        size: 'Size',
    },
    validationErrors: {
        asset: 'Please choose an asset file',
    },
    serverErrors: {
        asset_not_found: 'Asset is not found',
    },
    analyzingAsset: 'Asset is being analyzed',
    analysisError: 'Analysis Error',
    assetDetails: 'Asset Details',
    canUploadAsset: () => (<>You can upload a new one by using <strong>Upload Asset</strong> button</>),
    noAsset: 'There is no asset to display yet',
    noAssetForPage: (page?: number | string) => (<>There is no asset to display for <strong>page {page}</strong></>),
    assetNotFound: (id: string) => (<>Could not find the asset with id <strong>{id}</strong></>),
};

export const common = {
    actions: {
        activate: 'Activate',
        add: 'Add',
        cancel: 'Cancel',
        create: 'Create',
        confirm: 'Confirm',
        delete: 'Delete',
        discard: 'Discard',
        edit: 'Edit',
        install: 'Install',
        save: 'Save',
        uninstall: 'Uninstall',
    },
    labels: {
        active: 'Active',
        createdAt: 'Created At',
        description: 'Description',
        details: 'Details',
        global: 'Global',
        key: 'Key',
        locale: 'Locale',
        name: 'Name',
        namespace: 'Namespace',
        optional: 'optional',
    },
    loading: 'Loading',
    loadingError: 'Encountered an error while loading',
    loadingItemError: (item: string) => `Encountered an error while loading ${item}`,
};

export const content = {
    content: 'Content',
    actions: {
        addValue: 'Add Value',
        confirmDelete: (name: string) => (<>Are you sure about deleting the content <strong>{name}</strong></>),
        confirmDeleteValue: (name: string) => (<>Are you sure about deleting the value for field <strong>{name}</strong></>),
        contentCreated: (name: string) => `Content "${name}" is created successfully`,
        contentDeleted: (name: string) => `Content "${name}" is deleted successfully`,
        contentUpdated: (name: string) => `Content "${name}" is updated successfully`,
        createContent: 'Create Content',
        editValue: 'Edit Value',
        markDraft: 'Mark as draft',
        markedDraft: (name: string) => `Content "${name}" is marked as draft`,
        pickAsset: 'Pick Asset',
        publish: 'Publish',
        published: (name: string) => `Content "${name}" is published`,
        selectLocale: 'Select a locale',
        valueCreated: (field: string) => `Value for field "${field}" is created successfully`,
        valueDeleted: (field: string) => `Value for field "${field}" is deleted successfully`,
        valueUpdated: (field: string) => `Value for field "${field}" is updated successfully`,
    },
    labels: {
        createdBy: 'Created By',
        fieldName: 'Field Name',
        model: 'Model',
        value: 'Value',
        values: 'Values',
        stage: 'Stage',
        unknownField: 'Unknown Field',
        unsupportedField: 'Unsupported Field',
    },
    validationErrors: {
        locale: 'Please select a locale',
        name: 'Please enter a name',
        valueAsset: (field: string) => `Please pick an asset for ${field}`,
        value: (field: string) => `Please specify a value for ${field}`,
    },
    serverErrors: {
        missing_required_field: 'Missing a required field',
    },
    stages: {
        [ContentStage.Draft]: 'Draft',
        [ContentStage.Published]: 'Published',
    },
    noContent: (model: string) => (<>There is no content for the <strong>{model}</strong> model to display yet. You can create a new one by using <strong>Create Content</strong> button</>),
    noContentForPage: (page: string) => (<>There is no content to display for <strong>page {page}</strong></>),
    noModel: () => (<>A <strong>Model</strong> needs to be created first to create a <strong>Content</strong>. You can create a new model in <A href="/models">Models</A> page</>),
    noModelFound: 'No model found',
    contentNotFound: (id: string) => (<>Could not find the content with id <strong>{id}</strong></>),
};

export const dashboard = {
    loggedIn: (name: string) => (<>You have logged in as <strong>{name}</strong></>),
    welcome: 'It is a good day to start',
};

export const model = {
    model: 'Model',
    actions: {
        addField: 'Add Field',
        confirmDeleteModel: (name: string) => (<>Are you sure about deleting the model <strong>{name}</strong></>),
        confirmDeleteField: (name: string) => (<>Are you sure about deleting the field <strong>{name}</strong></>),
        createModel: 'Create Model',
        editField: 'Edit Field',
        fieldCreated: (name: string) => `Field "${name}" is created successfully`,
        fieldDeleted: (name: string) => `Field "${name}" is deleted successfully`,
        fieldUpdated: (name: string) => `Field "${name}" is updated successfully`,
        modelCreated: (name: string) => `Model "${name}" is created successfully`,
        modelDeleted: (name: string) => `Model "${name}" is deleted successfully`,
        modelUpdated: (name: string) => `Model "${name}" is updated successfully`,
        selectField: 'Select a field',
    },
    labels: {
        activeTheme: 'Active Theme',
        fields: 'Fields',
        field: 'Field',
    },
    fields: {
        asset: 'Asset',
        integer: 'Integer',
        multiline: 'Multiline',
        text: 'Text',
    },
    fieldFeatures: {
        localized: 'Localized',
        required: 'Required',
        multiple: 'Multiple',
    },
    validationErrors: {
        key: 'Please enter a key',
        name: 'Please enter a name',
        field: 'Please add at least one field',
        selectField: 'Please select a field',
    },
    serverErrors: {
        model_already_exists: 'Model with given key already exists',
    },
    modelNotFound: (key: string) => (<>Could not find the model with key <strong>{key}</strong></>),
    noModel: () => (<>There is no model to display yet. You can create a new one by using <strong>Create Model</strong> button</>),
};

export const nav = {
    links: {
        dashboard: 'Dashboard',
        models: 'Models',
        contents: 'Contents',
        assets: 'Assets',
        appearance: 'Appearance',
        themes: 'Themes',
        templates: 'Templates',
        pages: 'Pages',
        admin: 'Administration',
        locales: 'Locales',
        roles: 'Roles',
        usersPerms: 'Users & Perms',
        settings: 'Settings',
    },
    profile: {
        profile: 'Profile',
        logout: 'Log out',
    },
    colorModes: {
        [ColorMode.Auto]: 'Auto',
        [ColorMode.Light]: 'Light',
        [ColorMode.Dark]: 'Dark',
    }
};

export const pagination = {
    previous: 'Previous',
    next: 'Next',
};

export const theme = {
    actions: {
        confirmUninstall: (name: string, id: string) => (<>Are you sure about uninstalling the theme <strong>{name} ({id})</strong></>),
        installTheme: 'Install Theme',
        chooseThemeFile: 'Choose a theme file',
        themeActivated: (name: string) => `Theme "${name}" is activated successfully`,
        themeInstalled: (name: string) => `Theme "${name}" is installed successfully`,
        themeUninstalled: (name: string) => `Theme "${name}" is uninstalled successfully`,
    },
    labels: {
        id: 'ID',
        analysisError: 'Analysis Error',
        analyzingTheme: 'Theme is being analyzed',
        themeDetails: 'Theme Details',
        version: 'Version',
    },
    analysisErrors: {
        invalidTheme: 'Invalid theme file',
        manifestNotFound: 'Could not find manifest file',
    },
    validationErrors: {
        theme: 'Please choose a theme file',
    },
    serverErrors: {
        failed_reading_zip: 'Invalid zip file',
        invalid_manifest_file: 'Invalid manifest file',
        no_manifest_file: 'Missing manifest file in theme',
        theme_already_exists: 'Theme already exists',
        unknown_field: 'Unknown field in manifest',
    },
    noTheme: () => (<>There is no theme installed yet. You can install a new one by using <strong>Install Theme</strong> button</>),
};
