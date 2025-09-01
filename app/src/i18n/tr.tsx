import { A } from '@solidjs/router';
import type * as en from './en';
import { ColorMode } from "../theme";
import { ContentStage } from '../lib/cms/models';

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
        discard: 'İptal Et',
        edit: 'Düzenle',
        install: 'Yükle',
        save: 'Kaydet',
        uninstall: 'Kaldır',
    },
    labels: {
        active: 'Etkin',
        activeTheme: 'Etkin Tema',
        createdAt: 'Oluşturulma Zamanı',
        description: 'Açıklama',
        details: 'Detaylar',
        global: 'Global',
        key: 'Anahtar',
        locale: 'Yerel',
        name: 'İsim',
        namespace: 'İsim Alanı',
        optional: 'isteğe bağlı',
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
        selectLocale: 'Bir yerel seçin',
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
        locale: 'Lütfen bir yerel seçin',
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
        localized: 'Yerel',
        required: 'Zorunlu',
        multiple: 'Çoklu',
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
        locales: 'Yerel Ayarlar',
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

export const pagination: typeof en.pagination = {
    previous: 'Önceki',
    next: 'Sonraki',
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
