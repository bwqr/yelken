import { A } from "@solidjs/router";
import { ColorMode } from "../theme";

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

export const admin = {
    settings: {
        locale: 'Locale',
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
        add: 'Add',
        cancel: 'Cancel',
        create: 'Create',
        confirm: 'Confirm',
        delete: 'Delete',
        discard: 'Discard',
        edit: 'Edit',
        save: 'Save',
    },
    labels: {
        createdAt: 'Created At',
        description: 'Description',
        details: 'Details',
        global: 'Global',
        key: 'Key',
        name: 'Name',
        namespace: 'Namespace',
        optional: 'optional',
    },
    loading: 'Loading',
    loadingError: 'Encountered an error while loading',
    loadingItemError: (item: string) => `Encountered an error while loading ${item}`,
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
