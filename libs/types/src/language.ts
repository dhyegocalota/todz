export enum Language {
  English = 'en',
  PortugueseBrazil = 'pt-BR',
  Spanish = 'es',
  German = 'de',
  French = 'fr',
  Japanese = 'ja',
  Korean = 'ko',
  Chinese = 'zh',
}

export type LanguageProfile = {
  nativeName: string;
  pathPrefix: string;
  htmlLang: string;
  docsFolder: string;
  openGraphLocale: string;
};

export const LANGUAGE_PROFILES: Record<Language, LanguageProfile> = {
  [Language.English]: { nativeName: 'English', pathPrefix: '', htmlLang: 'en', docsFolder: '', openGraphLocale: 'en_US' },
  [Language.PortugueseBrazil]: {
    nativeName: 'Português (Brasil)',
    pathPrefix: '/pt-br',
    htmlLang: 'pt-BR',
    docsFolder: 'pt-br',
    openGraphLocale: 'pt_BR',
  },
  [Language.Spanish]: { nativeName: 'Español', pathPrefix: '/es', htmlLang: 'es', docsFolder: 'es', openGraphLocale: 'es_ES' },
  [Language.German]: { nativeName: 'Deutsch', pathPrefix: '/de', htmlLang: 'de', docsFolder: 'de', openGraphLocale: 'de_DE' },
  [Language.French]: { nativeName: 'Français', pathPrefix: '/fr', htmlLang: 'fr', docsFolder: 'fr', openGraphLocale: 'fr_FR' },
  [Language.Japanese]: { nativeName: '日本語', pathPrefix: '/ja', htmlLang: 'ja', docsFolder: 'ja', openGraphLocale: 'ja_JP' },
  [Language.Korean]: { nativeName: '한국어', pathPrefix: '/ko', htmlLang: 'ko', docsFolder: 'ko', openGraphLocale: 'ko_KR' },
  [Language.Chinese]: { nativeName: '简体中文', pathPrefix: '/zh', htmlLang: 'zh-CN', docsFolder: 'zh', openGraphLocale: 'zh_CN' },
};
