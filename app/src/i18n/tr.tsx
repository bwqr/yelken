import type * as en from './en';
import { A } from '@solidjs/router';
import { ColorMode } from "../theme";
import { ContentStage } from '../lib/cms/models';
import { Permission } from '../lib/models';
import { UserState } from '../lib/user/models';

export const auth: typeof en.auth = {
    login: {
        title: 'Yelken\'e Giriş Yap',
        subtitle: 'Websitenizi yönetmek için giriş yapın',
        slogan: 'Websitenizi yönetmenin kolay yolu',
        login: 'Giriş Yap',
        email: 'E-posta',
        password: 'Parola',
        validationErrors: {
            email: 'Lütfen e-posta adresinizi girin',
            password: 'Lütfen parolanızı girin',
        },
        serverErrors: {
            invalid_credentials: 'Bilgiler geçersiz',
            user_not_created_with_email: 'Kullanıcı başka bir yöntem ile giriş yapıyor',
        },
    }
};

export const app: typeof en.app = {
    pageNotFound: () => (<>Sayfa bulunamadı. <A href="/">Ana Sayfaya</A> geri dön.</>),
};

export const asset: typeof en.asset = {
    asset: 'Kaynak',
    actions: {
        pickAsset: 'Bir Kaynak Seçin',
        uploadAsset: 'Kaynak Yükle',
        chooseAsset: 'Bir kaynak dosyası seçin',
        upload: 'Yükle',
        assetUploaded: (name: string) => `"${name}" isimli kaynak başarılı bir şekilde yüklendi`,
        assetUpdated: (name: string) => `"${name}" isimli kaynak başarılı bir şekilde güncellendi`,
        assetDeleted: (name: string) => `"${name}" isimli kaynak başarılı bir şekilde silindi`,
        confirmDelete: (name: string) => (<><strong>{name}</strong> isimli kaynağı silmek istediğinizden emin misiniz</>),
    },
    labels: {
        link: 'Link',
        type: 'Tür',
        size: 'Boyut',
    },
    validationErrors: {
        asset: 'Lütfen bir kaynak dosyası seçin',
    },
    serverErrors: {
        asset_not_found: 'Kaynak bulunamadı',
    },
    analyzingAsset: 'Kaynak inceleniyor',
    analysisError: 'İnceleme Hatası',
    assetDetails: 'Kaynak Detayı',
    canUploadAsset: () => (<><strong>Kaynak Yükle</strong> butonunu kullanarak yeni bir tane yükleyebilirsin</>),
    noAsset: 'Herhangi bir kaynak bulunmuyor',
    noAssetForPage: (page?: number | string) => (<><strong>Sayfa {page}</strong> için gösterilebilecek herhangi bir kaynak bulunmuyor</>),
    assetNotFound: (id: string) => (<><strong>{id}</strong> ile tanımlanan kaynak bulunamadı</>),
};

export const common: typeof en.common = {
    actions: {
        activate: 'Etkinleştir',
        add: 'Ekle',
        cancel: 'İptal Et',
        create: 'Oluştur',
        confirm: 'Onayla',
        delete: 'Sil',
        disable: 'Devre dışı bırak',
        discard: 'İptal Et',
        edit: 'Düzenle',
        enable: 'Etkin hale getir',
        install: 'Yükle',
        save: 'Kaydet',
        uninstall: 'Kaldır',
    },
    labels: {
        active: 'Etkin',
        activeTheme: 'Etkin Tema',
        createdAt: 'Oluşturulma Zamanı',
        default: 'Varsayılan',
        description: 'Açıklama',
        details: 'Detaylar',
        disabled: 'Devre Dışı',
        global: 'Global',
        key: 'Anahtar',
        locale: 'Dil',
        name: 'İsim',
        namespace: 'İsim Alanı',
        no: 'Hayır',
        optional: 'isteğe bağlı',
        yes: 'Evet',
    },
    loading: 'Yükleniyor',
    loadingItem: (item: string) => `${item} yükleniyor`,
    loadingError: 'Encountered an error while loading',
    loadingItemError: (item: string) => `${item} yüklenmesi sırasında bir hata ile karşılaşıldı`,
};

export const content: typeof en.content = {
    content: 'İçerik',
    actions: {
        addValue: 'Değer Ekle',
        confirmDelete: (name: string) => (<><strong>{name}</strong> isimli içeriği silmek istediğinizden emin misiniz</>),
        confirmDeleteValue: (name: string) => (<><strong>{name}</strong> alanına ait değeri silmek istediğinizden emin misiniz</>),
        contentCreated: (name: string) => `"${name}" isimli içerik başarılı bir şekilde oluşturuldu`,
        contentDeleted: (name: string) => `"${name}" isimli içerik başarılı bir şekilde silindi`,
        contentUpdated: (name: string) => `"${name}" isimli içerik başarılı bir şekilde güncellendi`,
        createContent: 'İçerik Oluştur',
        editValue: 'Değer Düzenle',
        markDraft: 'Taslak olarak işaretle',
        markedDraft: (name: string) => `"${name}" isimli içerik taslak olarak işaretlendi`,
        pickAsset: 'Kaynak Seçin',
        publish: 'Yayınla',
        published: (name: string) => `"${name}" isimli içerik yayınlandı`,
        selectLocale: 'Bir dil seçin',
        valueCreated: (field: string) => `"${field}" alanı için olan değer başarılı bir şekilde oluşturuldu`,
        valueDeleted: (field: string) => `"${field}" alanı için olan değer başarılı bir şekilde silindi`,
        valueUpdated: (field: string) => `"${field}" alanı için olan değer başarılı bir şekilde güncellendi`,
    },
    labels: {
        createdBy: 'Oluşturan',
        fieldName: 'Alan İsmi',
        model: 'Model',
        value: 'Değer',
        values: 'Değerler',
        stage: 'Aşama',
        unknownField: 'Bilinmeyen Alan',
        unsupportedField: 'Desteklenmeyen Alan',
    },
    validationErrors: {
        locale: 'Lütfen bir dil seçin',
        name: 'Lütfen bir isim girin',
        valueAsset: (field: string) => `Lütfen ${field} için bir kaynak seçin`,
        value: (field: string) => `Lütfen ${field} için bir değer girin`,
    },
    serverErrors: {
        missing_required_field: 'Zorunlu bir alan eksik',
    },
    stages: {
        [ContentStage.Draft]: 'Taslak',
        [ContentStage.Published]: 'Yayınlandı',
    },
    noContent: (model: string) => (<><strong>{model}</strong> modeline ait herhangi bir içerik bulunamadı. <strong>İçerik Oluştur</strong> butonunu kullanarak yeni bir içerik oluşturabilirsin</>),
    noContentForPage: (page: string) => (<><strong>Sayfa {page}</strong> için gösterilebilecek herhangi bir içerik bulunmuyor</>),
    noModel: () => (<><strong>İçerik</strong> oluşturmak için öncelikle bir <strong>Model</strong> oluşturulması gerekiyor. Yeni bir modeli <A href="/models">Modeller</A> sayfasında oluşturabilirsin</>),
    noModelFound: 'Model bulunamadı',
    contentNotFound: (id: string) => (<><strong>{id}</strong> ile tanımlanan içerik bulunamadı</>),
};

export const dashboard: typeof en.dashboard = {
    loggedIn: (name: string) => (<><strong>{name}</strong> kullanıcısı ile giriş yaptınız</>),
    welcome: 'Başlamak için güzel bir gün',
};

export const locale: typeof en.locale = {
    actions: {
        confirmDelete: (name: string, key: string) => (<><strong>{name} ({key})</strong> isimli dili silmek istediğinizden emin misiniz</>),
        createLocale: 'Dil Oluştur',
        localeCreated: (name: string) => `"${name}" isimli dil oluşturuldu`,
        localeDeleted: (name: string) => `"${name}" isimli dil silindi`,
        localeDisabled: (name: string) => `"${name}" isimli dil devre dışı bırakıldı`,
        localeEnabled: (name: string) => `"${name}" isimli dil etkin hale getirildi`,
        localeUpdated: (name: string) => `"${name}" isimli dil güncellendi`,
        setDefault: (name: string) => `"${name}" isimli dil varsayılan olarak güncelle`,
        setAsDefault: 'Varsayılan olarak güncelle',
        translationsUpdated: (name: string) => `"${name}" diline ait çeviriler güncellendi`,
    },
    labels: {
        editor: 'Metin Düzenleyicisi',
        globalTranslations: 'Global çeviriler',
        namePlaceholder: 'Dilin ismi, ornk. Türkçe',
        keyPlaceholder: 'Dili tanımlayacak anahtar, ornk. tr',
        themeTranslations: (theme: string) => (<><strong>({theme})</strong> isimli temaya ait çeviriler</>),
        themeTranslations2: 'Temaya Ait Çeviriler',
        themeScopedTranslations: (theme: string) => (<><strong>({theme})</strong> isimli tema bazında yapılan çeviriler</>),
        translations: 'Çeviriler',
    },
    validationErrors: {
        key: 'Lütfen dil için bir anahtar belirtin',
        name: 'Lütfen dil için bir isim belirtin',
    },
    serverErrors: {
        locale_being_used: 'Dil hala kullanılıyor',
    },
    cannotModifyThemeResourceInfo: 'Temaya ait çeviriler düzenlenemez. Temadaki çevirileri düzenlemek için tema bazında düzenleme yapmanız gerekir',
    cannotModifyThemeResource: 'Temaya ait bir kaynak değiştirilemez',
    localeNotFound: (key: string) => (<><strong>{key}</strong> anahtarı ile tanımlanan dil bulunamadı</>),
    noLocale: () => (<>Herhangi bir dil bulunmuyor. <strong>Dil Oluştur</strong> butonunu kullanarak yeni bir dil oluşturabilirsin</>),
    unknownKind: (kind: string) => (<>Uzantıda bilinmeyen tür <strong>{kind}</strong> bulunuyor veya isim alanı bulunamadı</>),
};

export const model: typeof en.model = {
    model: 'Model',
    actions: {
        addField: 'Alan Ekle',
        confirmDeleteModel: (name: string) => (<><strong>{name}</strong> isimli modeli silmek istediğinizden emin misiniz</>),
        confirmDeleteField: (name: string) => (<><strong>{name}</strong> isimli alanı silmek istediğinizden emin misiniz</>),
        createModel: 'Model Oluştur',
        editField: 'Alan Düzenle',
        fieldCreated: (name: string) => `"${name}" isimli alan başarılı bir şekilde oluşturuldu`,
        fieldDeleted: (name: string) => `"${name}" isimli alan başarılı bir şekilde silindi`,
        fieldUpdated: (name: string) => `"${name}" isimli alan başarılı bir şekilde güncellendi`,
        modelCreated: (name: string) => `"${name}" isimli model başarılı bir şekilde oluşturuldu`,
        modelDeleted: (name: string) => `"${name}" isimli model başarılı bir şekilde silindi`,
        modelUpdated: (name: string) => `"${name}" isimli model başarılı bir şekilde güncellendi`,
        selectField: 'Bir alan seçin',
    },
    labels: {
        fields: 'Alanlar',
        field: 'Alan',
    },
    fields: {
        asset: 'Kaynak',
        integer: 'Sayı',
        multiline: 'Çoklu Satır Metin',
        text: 'Metin',
    },
    fieldFeatures: {
        localized: 'Çoklu Dil',
        required: 'Zorunlu',
        multiple: 'Çoklu Değer',
    },
    validationErrors: {
        key: 'Lütfen bir anahtar girin',
        name: 'Lütfen bir isim girin',
        field: 'Lütfen en az bir tane alan ekleyin',
        selectField: 'Lütfen bir alan seçin',
    },
    serverErrors: {
        model_already_exists: 'Belirtilen anahtara ait bir model zaten bulunuyor',
    },
    modelNotFound: (key: string) => (<><strong>{key}</strong> anahtarı ile tanımlanan model bulunamadı</>),
    noModel: () => (<>Herhangi bir model bulunmuyor. <strong>Model Oluştur</strong> butonunu kullanarak yeni bir tane oluşturabilirsin</>),
};

export const nav: typeof en.nav = {
    links: {
        dashboard: 'Panel',
        models: 'Modeller',
        contents: 'İçerikler',
        assets: 'Kaynaklar',
        appearance: 'Görünüş',
        themes: 'Temalar',
        templates: 'Şablonlar',
        pages: 'Sayfalar',
        admin: 'Yönetim',
        locales: 'Dil Ayarları',
        roles: 'Roller',
        usersPerms: 'Kullanıcılar ve İzinler',
        settings: 'Ayarlar',
    },
    profile: {
        profile: 'Profil',
        logout: 'Çıkış yap',
    },
    colorModes: {
        [ColorMode.Auto]: 'Otomatik',
        [ColorMode.Light]: 'Açık',
        [ColorMode.Dark]: 'Koyu',
    }
};

export const page: typeof en.page = {
    page: 'Sayfa',
    actions: {
        confirmDelete: (path: string, locale: string) => (<><strong>{path} ({locale})</strong> uzantı yoluna sahip sayfa girdisini silmek istediğinizden emin misiniz? Eğer bu girdi, sayfaya ait son girdi ise bu eylem aynı zamanda sayfayı da silecektir</>),
        createEntry: 'Girdi Oluştur',
        createPage: 'Sayfa Oluştur',
        pageCreated: (name: string) => `"${name}" isimli sayfa oluşturuldu`,
        pageEntryDeleted: (path: string, locale: string) => `"${path} (${locale})" uzantı yoluna sahip sayfa girdisi silindi`,
        pageUpdated: (name: string) => `"${name}" isimli sayfa güncellendi`,
        selectTemplate: 'Bir şablon seçin',
    },
    labels: {
        entries: 'Girdiler',
        globalPages: 'Global Sayfalar',
        notLocalized: 'Çoklu dil desteği yok',
        path: 'Uzantı Yolu',
        paths: 'Uzantı Yolları',
        themeScopedPages: 'Tema Bazlı Sayfalar',
    },
    validationErrors: {
        key: 'Lütfen sayfa için bir anahtar belirtin',
        locale: 'Lütfen sayfa için bir dil seçin',
        name: 'Lütfen sayfa için bir isim belirtin',
        path: 'Lütfen sayfa için bir uzantı yolu belirtin',
        template: 'Lütfen bir şablon seçin',
    },
    serverErrors: {
        page_already_exists: 'Sayfa zaten mevcut',
    },
    noPage: (namespace: string) => (<><strong>{namespace}</strong> isim alanı içerisinde herhangi bir sayfa bulunmuyor. <strong>Sayfa Oluştur</strong> butonunu kullanarak yeni bir sayfa oluşturabilirsin</>),
    pageNotFound: (key: string) => (<><strong>{key}</strong> anahtarına sahip sayfa bulunamadı</>),
};

export const pagination: typeof en.pagination = {
    previous: 'Önceki',
    next: 'Sonraki',
};

export const role: typeof en.role = {
    role: 'Rol',
    actions: {
        confirmDelete: (name: string) => (<><strong>{name}</strong> isimli rolü silmek istediğinizden emin misiniz</>),
        createRole: 'Rol Oluştur',
        permissionsUpdated: (name: string) => `"${name}" isimli role ait izinler güncellendi`,
        roleCreated: (name: string) => `"${name}" isimli rol oluşturuldu`,
        roleDeleted: (name: string) => `"${name}" isimli rol silindi`,
        roleUpdated: (name: string) => `"${name}" isimli rol güncellendi`
    },
    labels: {
        keyPlaceholder: 'Tanımlama anahtarı',
        namePlaceholder: 'Rolün ismi',
        permissions: 'İzinler',
    },
    validationErrors: {
        key: 'Lütfen rol için bir anahtar belirtin',
        name: 'Lütfen rol için bir isim belirtin',
    },
    serverErrors: {
        already_exists: 'Rol zaten mevcut',
        role_not_found: 'Rol bulunamadı',
    },
    permissions: {
        [Permission.Admin]: 'Yönetici',
        [Permission.AppearanceRead]: 'Görünüm Okuma',
        [Permission.AssetWrite]: 'Kaynak Oluşturma',
        [Permission.CMSRead]: 'CMS Okuma',
        [Permission.ContentWrite]: 'İçerik Oluşturma',
        [Permission.ModelWrite]: 'Model Oluşturma',
        [Permission.PageWrite]: 'Sayfa Oluşturma',
        [Permission.TemplateWrite]: 'Şablon Oluşturma',
        [Permission.ThemeWrite]: 'Tema Yükleme',
    },
    roleNotFound: (key: string) => (<><strong>{key}</strong> anahtarı ile tanımlanan rol bulunamadı</>),
    noRole: () => (<>Herhangi bir rol bulunmuyor. <strong>Rol Oluştur</strong> butonunu kullanarak yeni bir rol oluşturabilirsin</>),
};

export const template: typeof en.template = {
    template: 'Şablon',
    actions: {
        confirmDelete: (path: string) => (<><strong>{path}</strong> dosya yolunda bulunan şablonu silmek istediğinize emin misiniz</>),
        confirmRevert: (path: string) => (<><strong>{path}</strong> dosya yolunda bulunan şablonda yapılan değişiklikleri geri almak istediğinize emin misiniz</>),
        createTemplate: 'Şablon Oluştur',
        revert: 'Geri Al',
        templateCreated: (path: string) => `"${path}" dosya yolunda bulunan şablon başarılı bir şekilde oluşturuldu`,
        templateDeleted: (path: string) => `"${path}" dosya yolunda bulunan şablon başarılı bir şekilde silindi`,
        templateUpdated: (path: string) => `"${path}" dosya yolunda bulunan şablon başarılı bir şekilde güncellendi`,
    },
    labels: {
        globalTemplate: 'Global Şablon',
        modified: 'Değiştirildi',
        namespaces: 'İsim Alanları',
        path: 'Dosya Yolu',
        pathPlaceholder: 'Şablon dosya yolu, örnk. index.html',
        overridenGlobally: 'Global Şablon Etkin',
        scopedTemplate: 'Tema Şablon',
    },
    validationErrors: {
        path: 'Lütfen en az 3 karakter içeren bir dosya yolu girin',
        notHtmlPath: () => (<>Dosya yolu <strong>.html</strong> ile bitmek zorunda</>),
    },
    serverErrors: {},
    missingPath: () => (<><strong>Dosya Yolu</strong> uzantı içindeki arama parametrelerinde bulunmuyor</>),
    noTemplateForNamespace: (namespace: string) => (<><strong>{namespace}</strong> isim alanı içerisinde herhangi bir şablon bulunmuyor. <strong>Şablon Oluştur</strong> butonunu kullanarak yeni bir şablon oluşturabilirsin</>),
    templateNotFound: (path: string) => (<><strong>{path}</strong> dosya yolunda bulunan şablon bulunamadı</>),
};

export const theme: typeof en.theme = {
    actions: {
        confirmUninstall: (name: string, id: string) => (<><strong>{name} ({id})</strong> isimli temayı kaldırmak istediğinizden emin misiniz</>),
        installTheme: 'Tema Yükle',
        chooseThemeFile: 'Bir tema dosyası seçin',
        themeActivated: (name: string) => `"${name}" isimli tema başarılı bir şekilde etkinleştirildi`,
        themeInstalled: (name: string) => `"${name}" isimli tema başarılı bir şekilde yüklendi`,
        themeUninstalled: (name: string) => `"${name}" isimli tema başarılı bir şekilde silindi`,
    },
    labels: {
        id: 'ID',
        analysisError: 'İnceleme Hatası',
        analyzingTheme: 'Tema inceleniyor',
        themeDetails: 'Tema Detayı',
        version: 'Sürüm',
    },
    analysisErrors: {
        invalidTheme: 'Geçersiz tema dosyası',
        manifestNotFound: 'Manifest dosyası bulunamadı',
    },
    validationErrors: {
        theme: 'Lütfen bir tema dosyası seçin',
    },
    serverErrors: {
        failed_reading_zip: 'Geçersiz zip dosyası',
        invalid_manifest_file: 'Geçersiz manifest dosyası',
        no_manifest_file: 'Manifest dosyası tema içerisinde bulunamadı',
        theme_already_exists: 'Tema zaten yüklü',
        unknown_field: 'Manifest içerisinde bilinmeyen bir alan var',
    },
    noTheme: () => (<>Herhangi bir tema yüklü değil. <strong>Tema Yükle</strong> butonunu kullanarak yeni bir tema yükleyebilirsin</>),
};

export const user: typeof en.user = {
    user: 'Kullanıcı',
    users: 'Kullanıcılar',
    actions: {
        confirmDelete: (name: string, username: string) => (<><strong>{name} ({username})</strong> isimli kullanıcıyı silmek istediğinizde emin misiniz</>),
        createUser: 'Kullanıcı Oluştur',
        permissionsUpdated: (name: string) => `"${name}" isimli kullanıcıya ait izinler güncellendi`,
        userCreated: (name: string) => `"${name}" isimli kullanıcı oluşturuldu`,
        userDeleted: (name: string) => `"${name}" isimli kullanıcı silindi`,
        userUpdated: (name: string) => `"${name}" isimli kullanıcı güncellendi`,
    },
    labels: {
        additionalPerms: 'Ek İzinler',
        email: 'E-posta',
        noRole: 'Role Yok',
        password: 'Parola',
        passwordConfirm: 'Parola Onayı',
        state: 'Durum',
    },
    validationErrors: {
        email: 'Lütfen kullanıcı için bir e-posta belirtin',
        name: 'Lütfen kullanıcı için bir isim belirtin',
        password: 'Lütfen kullanıcı için bir parola belirtin',
        passwordConfirm: 'Lütfen belirttiğiniz parolayı tekrar girin',
    },
    serverErrors: {
        role_not_found: 'Rol bulunamadı',
        self_update_not_possible: 'Kendini güncelleyemezsin',
        user_not_found: 'Kullanıcı bulunamadı',
    },
    userStates: {
        [UserState.Enabled]: 'Etkin',
        [UserState.Disabled]: 'Devre Dışı',
    },
    userNotFound: (username: string) => (<><strong>{username}</strong> kullanıcı adına sahip kullanıcı bulunamadı</>),
    noUser: () => (<>Herhangi bir kullanıcı bulunmuyor. <strong>Kullanıcı Oluştur</strong> butonunu kullanarak yeni bir kullanıcı oluşturabilirsiniz</>),
};
