export enum Language {
  English = 'en',
  PortugueseBrazil = 'pt-BR',
  Spanish = 'es',
  German = 'de',
  French = 'fr',
  Japanese = 'ja',
  Korean = 'ko',
  Chinese = 'zh',
  Arabic = 'ar',
  Hindi = 'hi',
}

export enum TextDirection {
  Ltr = 'ltr',
  Rtl = 'rtl',
}

export type LanguageProfile = {
  nativeName: string;
  pathPrefix: string;
  htmlLang: string;
  docsFolder: string;
  openGraphLocale: string;
  direction: TextDirection;
};

export const LANGUAGE_PROFILES: Record<Language, LanguageProfile> = {
  [Language.English]: {
    nativeName: 'English',
    pathPrefix: '',
    htmlLang: 'en',
    docsFolder: '',
    openGraphLocale: 'en_US',
    direction: TextDirection.Ltr,
  },
  [Language.PortugueseBrazil]: {
    nativeName: 'Português (Brasil)',
    pathPrefix: '/pt-br',
    htmlLang: 'pt-BR',
    docsFolder: 'pt-br',
    openGraphLocale: 'pt_BR',
    direction: TextDirection.Ltr,
  },
  [Language.Spanish]: {
    nativeName: 'Español',
    pathPrefix: '/es',
    htmlLang: 'es',
    docsFolder: 'es',
    openGraphLocale: 'es_ES',
    direction: TextDirection.Ltr,
  },
  [Language.German]: {
    nativeName: 'Deutsch',
    pathPrefix: '/de',
    htmlLang: 'de',
    docsFolder: 'de',
    openGraphLocale: 'de_DE',
    direction: TextDirection.Ltr,
  },
  [Language.French]: {
    nativeName: 'Français',
    pathPrefix: '/fr',
    htmlLang: 'fr',
    docsFolder: 'fr',
    openGraphLocale: 'fr_FR',
    direction: TextDirection.Ltr,
  },
  [Language.Japanese]: {
    nativeName: '日本語',
    pathPrefix: '/ja',
    htmlLang: 'ja',
    docsFolder: 'ja',
    openGraphLocale: 'ja_JP',
    direction: TextDirection.Ltr,
  },
  [Language.Korean]: {
    nativeName: '한국어',
    pathPrefix: '/ko',
    htmlLang: 'ko',
    docsFolder: 'ko',
    openGraphLocale: 'ko_KR',
    direction: TextDirection.Ltr,
  },
  [Language.Chinese]: {
    nativeName: '简体中文',
    pathPrefix: '/zh',
    htmlLang: 'zh-CN',
    docsFolder: 'zh',
    openGraphLocale: 'zh_CN',
    direction: TextDirection.Ltr,
  },
  [Language.Arabic]: {
    nativeName: 'العربية',
    pathPrefix: '/ar',
    htmlLang: 'ar',
    docsFolder: 'ar',
    openGraphLocale: 'ar_AR',
    direction: TextDirection.Rtl,
  },
  [Language.Hindi]: {
    nativeName: 'हिन्दी',
    pathPrefix: '/hi',
    htmlLang: 'hi',
    docsFolder: 'hi',
    openGraphLocale: 'hi_IN',
    direction: TextDirection.Ltr,
  },
};
