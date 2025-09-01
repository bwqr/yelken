import { A } from "@solidjs/router";
import { ColorMode } from "../theme";
import { ContentStage } from "../lib/cms/models";
import { Permission } from "../lib/models";
import { UserState } from "../lib/user/models";
import { OptionKey } from "../lib/admin/models";

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
        disable: 'Disable',
        discard: 'Discard',
        edit: 'Edit',
        enable: 'Enable',
        install: 'Install',
        save: 'Save',
        uninstall: 'Uninstall',
    },
    labels: {
        active: 'Active',
        activeTheme: 'Active Theme',
        createdAt: 'Created At',
        default: 'Default',
        description: 'Description',
        details: 'Details',
        disabled: 'Disabled',
        global: 'Global',
        key: 'Key',
        locale: 'Locale',
        name: 'Name',
        namespace: 'Namespace',
        no: 'No',
        optional: 'optional',
        yes: 'Yes',
    },
    loading: 'Loading',
    loadingItem: (item: string) => `${item} is loading`,
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

export const locale = {
    actions: {
        confirmDelete: (name: string, key: string) => (<>Are you sure about deleting the locale <strong>{name} ({key})</strong></>),
        createLocale: 'Create Locale',
        localeCreated: (name: string) => `Locale "${name}" is created`,
        localeDeleted: (name: string) => `Locale "${name}" is deleted`,
        localeDisabled: (name: string) => `Locale "${name}" is disabled`,
        localeEnabled: (name: string) => `Locale "${name}" is enabled`,
        localeUpdated: (name: string) => `Locale "${name}" is updated`,
        setDefault: (name: string) => `Locale "${name}" is set as default`,
        setAsDefault: 'Set as default',
        translationsUpdated: (name: string) => `Translations of "${name}" locale is updated successfully`,
    },
    labels: {
        editor: 'Editor',
        globalTranslations: 'Global Translations',
        namePlaceholder: 'Name of locale, e.g. English',
        keyPlaceholder: 'Key of locale, e.g. en',
        themeTranslations: (theme: string) => (<>Theme's <strong>({theme})</strong> Translations</>),
        themeTranslations2: 'Theme\'s Translations',
        themeScopedTranslations: (theme: string) => (<>Theme <strong>({theme})</strong> Scoped Translations</>),
        translations: 'Translations',
    },
    validationErrors: {
        key: 'Please enter key for locale',
        name: 'Please enter name for locale',
    },
    serverErrors: {
        locale_being_used: 'Locale is being used',
    },
    cannotModifyThemeResourceInfo: 'Theme\'s translations cannot be modified. You need to override their values either globally or scoped to each theme',
    cannotModifyThemeResource: 'Cannot modify theme\'s own resource',
    localeNotFound: (key: string) => (<>Could not find the locale with key <strong>{key}</strong></>),
    noLocale: () => (<>There is no locale to display yet. You can create a new one by using <strong>Create Locale</strong> button</>),
    unknownKind: (kind: string) => (<>Unknown kind <strong>{kind}</strong> found in path or the namespace missing</>),
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

export const page = {
    page: 'Page',
    actions: {
        confirmDelete: (path: string, locale: string) => (<>Are you sure about deleting the page entry <strong>{path} ({locale})</strong>? This action will also delete the page if the entry is the last one</>),
        createEntry: 'Create Entry',
        createPage: 'Create Page',
        pageCreated: (name: string) => `Page "${name}" is created successfully`,
        pageEntryDeleted: (path: string, locale: string) => `Page entry "${path} (${locale})" is deleted successfully`,
        pageUpdated: (name: string) => `Page "${name}" is updated successfully`,
        selectTemplate: 'Select a template',
    },
    labels: {
        entries: 'Entries',
        globalPages: 'Global Pages',
        notLocalized: 'Not localized',
        path: 'Path',
        paths: 'Paths',
        themeScopedPages: 'Theme Scoped Pages',
    },
    validationErrors: {
        key: 'Please specify a key for page',
        locale: 'Please select a locale for page',
        name: 'Please specify a name for page',
        path: 'Please specify a path for page',
        template: 'Please select a template',
    },
    serverErrors: {
        page_already_exists: 'Page already exists',
    },
    noPage: (namespace: string) => (<>There is no page for the <strong>{namespace}</strong> namespace to display yet. You can create a new one by using <strong>Create Page</strong> button</>),
    pageNotFound: (key: string) => (<>Could not find the page with key <strong>{key}</strong></>),
};

export const pagination = {
    previous: 'Previous',
    next: 'Next',
};

export const role = {
    role: 'Role',
    actions: {
        confirmDelete: (name: string) => (<>Are you sure about deleting the role <strong>{name}</strong></>),
        createRole: 'Create Role',
        permissionsUpdated: (name: string) => `Permissions of "${name}" role are updated successfully`,
        roleCreated: (name: string) => `Role "${name}" is created`,
        roleDeleted: (name: string) => `Role "${name}" is deleted`,
        roleUpdated: (name: string) => `Role "${name}" is updated`
    },
    labels: {
        keyPlaceholder: 'Reference key',
        namePlaceholder: 'Name of role',
        permissions: 'Permissions',
    },
    validationErrors: {
        key: 'Please specify a key for role',
        name: 'Please specify a name for role',
    },
    serverErrors: {
        already_exists: 'Role already exists',
        role_not_found: 'Role could not be found',
    },
    permissions: {
        [Permission.Admin]: 'Admin',
        [Permission.AppearanceRead]: 'Appearance Read',
        [Permission.AssetWrite]: 'Asset Write',
        [Permission.CMSRead]: 'CMS Read',
        [Permission.ContentWrite]: 'Content Write',
        [Permission.ModelWrite]: 'Model Write',
        [Permission.PageWrite]: 'Page Write',
        [Permission.TemplateWrite]: 'Template Write',
        [Permission.ThemeWrite]: 'Theme Write',
    },
    roleNotFound: (key: string) => (<>Could not find the role with key <strong>{key}</strong></>),
    noRole: () => (<>There is no role to display yet. You can create a new one by using <strong>Create Role</strong> button</>),
};

export const settings = {
    actions: {
        optionUpdated: (name: string) => `Site option "${name}" is updated`,
    },
    labels: {
        siteOptions: 'Site Options',
    },
    siteOptions: {
        [OptionKey.Name]: 'Site Name',
        [OptionKey.Description]: 'Site Description',
        [OptionKey.Keywords]: 'Site Keywords',
    },
    serverErrors: {
        invalid_option_key: 'Invalid option key',
    },
};

export const template = {
    template: 'Template',
    actions: {
        confirmDelete: (path: string) => (<>Are you sure about deleting the template <strong>{path}</strong></>),
        confirmRevert: (path: string) => (<>Are you sure about reverting changes applied on the template <strong>{path}</strong></>),
        createTemplate: 'Create Template',
        revert: 'Revert',
        templateCreated: (path: string) => `Template "${path}" is created successfully`,
        templateDeleted: (path: string) => `Template "${path}" is deleted successfully`,
        templateUpdated: (path: string) => `Template "${path}" is updated successfully`,
    },
    labels: {
        globalTemplate: 'Global Template',
        modified: 'Modified',
        namespaces: 'Namespaces',
        path: 'Path',
        pathPlaceholder: 'Path of template, e.g. index.html',
        overridenGlobally: 'Overriden Globally',
        scopedTemplate: 'Theme Template',
    },
    validationErrors: {
        path: 'Please enter a path with at least 3 characters',
        notHtmlPath: () => (<>Path must end with <strong>.html</strong></>),
    },
    serverErrors: {},
    missingPath: () => (<><strong>Path</strong> is missing from search parameters</>),
    noTemplateForNamespace: (namespace: string) => (<>There is no template for the <strong>{namespace}</strong> namespace to display yet. You can create a new one by using <strong>Create Template</strong> button</>),
    templateNotFound: (path: string) => (<>Could not find the template with path <strong>{path}</strong></>),
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

export const user = {
    user: 'User',
    users: 'Users',
    actions: {
        confirmDelete: (name: string, username: string) => (<>Are you sure about deleting the user <strong>{name} ({username})</strong></>),
        createUser: 'Create User',
        permissionsUpdated: (name: string) => `"${name}" isimli kullanıcıya ait izinler güncellendi`,
        userCreated: (name: string) => `User "${name}" is created`,
        userDeleted: (name: string) => `User "${name}" is deleted`,
        userUpdated: (name: string) => `User "${name}" is updated`,
    },
    labels: {
        additionalPerms: 'Additional Permissions',
        email: 'Email',
        noRole: 'No Role',
        password: 'Password',
        passwordConfirm: 'Password Confirm',
        state: 'State',
    },
    validationErrors: {
        email: 'Please specify a email for user',
        name: 'Please specify a name for user',
        password: 'Please specify a password for user',
        passwordConfirm: 'Does not match the password',
    },
    serverErrors: {
        role_not_found: 'Role could not be found',
        self_update_not_possible: 'Cannot perform self update',
        user_not_found: 'User could not be found',
    },
    userStates: {
        [UserState.Enabled]: 'Enabled',
        [UserState.Disabled]: 'Disabled',
    },
    userNotFound: (username: string) => (<>Could not find the user with username <strong>{username}</strong></>),
    noUser: () => (<>There is no user to display yet. You can create a new one by using <strong>Create User</strong> button</>),
};
