import { COMPANY, LANGUAGE_PROFILES, Language, REPOSITORY } from '@todz/types';
import { escapedHtml } from '../escaped-html';
import { type PagePreferences, Theme } from '../page-preferences';
import { LANDING_COPY_BY_LANGUAGE } from './landing-copy';
import { languageMenuHtml, themeFormHtml } from './site-controls';
import { publicPathOf } from './language-paths';
import { SITE_GLYPH_SPRITE, SiteGlyph, glyphHtml } from './site-glyphs';
import { DARK_THEME_COLOR } from './site-constants';
import { OPEN_GRAPH_IMAGE, SITE_ICONS, SiteIcon } from './site-icons';
import { SITE_STYLE } from './site-style';
import { SWITCH_SCRIPT } from './site-switch-script';
import { starPillHtml } from './star-pill';
import { CONTENT_ID, DOCS_INSTALL_PAGE, DOCS_SELF_HOST_PAGE, DiscoveryPath, SITE_URL, docsUrlOf, LANDING_PATH } from './site-urls';

export { CONTENT_ID, LANDING_PATH };
const LIGHT_THEME_COLOR = '#F2F4FA';
const OPEN_GRAPH_TYPE = 'website';
const TWITTER_CARD = 'summary_large_image';
const X_DEFAULT_HREFLANG = 'x-default';
const SYSTEM_COLOR_SCHEME = 'light dark';

export enum SitePageKind {
  Public = 'public',
  Private = 'private',
}

type SiteDocumentContent = { title: string; description: string; main: string; scripts: string[]; preferences: PagePreferences };

export type SiteDocument =
  | (SiteDocumentContent & { kind: SitePageKind.Public; path: string; structuredData: string; stars: number | null })
  | (SiteDocumentContent & { kind: SitePageKind.Private; alternatePath?: string });

function homePathOf(language: Language): string {
  return publicPathOf({ language, path: LANDING_PATH });
}

function brandHtml(language: Language): string {
  const { shell } = LANDING_COPY_BY_LANGUAGE[language];
  return `<a class="brand" href="${homePathOf(language)}" aria-label="${escapedHtml(shell.homeLabel)}">${glyphHtml({ glyph: SiteGlyph.Icon, className: 'brand-icon' })}<span class="wordmark">${escapedHtml(shell.wordmark)}</span></a>`;
}

function headerHtml(preferences: PagePreferences): string {
  const { language } = preferences;
  const { shell } = LANDING_COPY_BY_LANGUAGE[language];
  return `<header class="site-header">
<div class="site-header-inner page-width">
${brandHtml(language)}
<nav class="site-nav" aria-label="${escapedHtml(shell.navLabel)}">
<a class="nav-link" href="${docsUrlOf({ language, page: DOCS_SELF_HOST_PAGE })}"><span class="label-long">${escapedHtml(shell.selfHostLink)}</span><span class="label-short">${escapedHtml(shell.selfHostLinkShort)}</span></a>
<a class="nav-link" href="${docsUrlOf({ language, page: DOCS_INSTALL_PAGE })}"><span class="label-long">${escapedHtml(shell.installLink)}</span><span class="label-short">${escapedHtml(shell.installLinkShort)}</span></a>
${languageMenuHtml(preferences)}
${themeFormHtml(preferences)}
</nav>
</div>
</header>`;
}

function creditHtml(language: Language): string {
  const { creditPrefix, creditLead, creditName, creditTail } = LANDING_COPY_BY_LANGUAGE[language].shell;
  return `<p class="footer-credit">${escapedHtml(creditPrefix)} ${escapedHtml(creditLead)} <a class="footer-credit-link" href="${escapedHtml(COMPANY.website)}" rel="noopener noreferrer">${escapedHtml(creditName)}</a>${escapedHtml(creditTail)}</p>`;
}

function starPillFooterHtml({ document, language }: { document: SiteDocument; language: Language }): string {
  if (document.kind === SitePageKind.Private) return '';
  return `${starPillHtml({ stars: document.stars, language })}\n`;
}

function sourceLinksHtml({ document, language }: { document: SiteDocument; language: Language }): string {
  if (document.kind === SitePageKind.Private) return '';
  const { license, contributing } = LANDING_COPY_BY_LANGUAGE[language].openSource;
  return `<a class="footer-link footer-open-source" href="${REPOSITORY.licenseUrl}" rel="noopener">${escapedHtml(license)}</a>
<a class="footer-link footer-open-source" href="${REPOSITORY.contributingUrl}" rel="noopener">${escapedHtml(contributing)}</a>
`;
}

function footerHtml(document: SiteDocument): string {
  const { language } = document.preferences;
  const { shell } = LANDING_COPY_BY_LANGUAGE[language];
  return `<footer class="site-footer">
<div class="site-footer-inner page-width">
${brandHtml(language)}
${creditHtml(language)}
${starPillFooterHtml({ document, language })}<div class="footer-links">
${sourceLinksHtml({ document, language })}<a class="footer-link" href="${docsUrlOf({ language, page: DOCS_SELF_HOST_PAGE })}">${escapedHtml(shell.footerSelfHost)}</a>
<a class="footer-link" href="${docsUrlOf({ language, page: DOCS_INSTALL_PAGE })}">${escapedHtml(shell.footerInstall)}</a>
</div>
</div>
</footer>`;
}

function scriptsHtml(scripts: string[]): string {
  return [...scripts, SWITCH_SCRIPT].map((script) => `\n<script>${script}</script>`).join('');
}

function propertyMetaHtml({ property, content }: { property: string; content: string }): string {
  return `<meta property="${property}" content="${escapedHtml(content)}">`;
}

function iconLinksHtml(): string {
  const favicon = SITE_ICONS[SiteIcon.Favicon];
  const vector = SITE_ICONS[SiteIcon.Vector];
  return `<link rel="icon" href="${favicon.path}" sizes="${favicon.size}x${favicon.size}">
<link rel="icon" href="${vector.path}" type="${vector.mediaType}">`;
}

function alternateLinksHtml(path: string): string {
  const languageLinks = Object.values(Language).map((language) => {
    const href = `${SITE_URL}${publicPathOf({ language, path })}`;
    return `<link rel="alternate" hreflang="${LANGUAGE_PROFILES[language].htmlLang}" href="${escapedHtml(href)}">`;
  });
  const defaultHref = `${SITE_URL}${publicPathOf({ language: Language.English, path })}`;
  return [...languageLinks, `<link rel="alternate" hreflang="${X_DEFAULT_HREFLANG}" href="${escapedHtml(defaultHref)}">`].join('\n');
}

function openGraphLocalesHtml(language: Language): string {
  const alternates = Object.values(Language)
    .filter((candidate) => candidate !== language)
    .map((candidate) => propertyMetaHtml({ property: 'og:locale:alternate', content: LANGUAGE_PROFILES[candidate].openGraphLocale }));
  return [propertyMetaHtml({ property: 'og:locale', content: LANGUAGE_PROFILES[language].openGraphLocale }), ...alternates].join('\n');
}

function publicHeadHtml({
  title,
  description,
  path,
  structuredData,
  language,
}: {
  title: string;
  description: string;
  path: string;
  structuredData: string;
  language: Language;
}): string {
  const pageUrl = `${SITE_URL}${publicPathOf({ language, path })}`;
  return `<link rel="canonical" href="${escapedHtml(pageUrl)}">
${alternateLinksHtml(path)}
<link rel="apple-touch-icon" href="${SITE_ICONS[SiteIcon.AppleTouch].path}">
<link rel="manifest" href="${DiscoveryPath.Manifest}">
${propertyMetaHtml({ property: 'og:title', content: title })}
${propertyMetaHtml({ property: 'og:description', content: description })}
${propertyMetaHtml({ property: 'og:url', content: pageUrl })}
${propertyMetaHtml({ property: 'og:type', content: OPEN_GRAPH_TYPE })}
${propertyMetaHtml({ property: 'og:site_name', content: LANDING_COPY_BY_LANGUAGE[language].meta.siteName })}
${openGraphLocalesHtml(language)}
${propertyMetaHtml({ property: 'og:image', content: `${SITE_URL}${OPEN_GRAPH_IMAGE.path}` })}
${propertyMetaHtml({ property: 'og:image:width', content: String(OPEN_GRAPH_IMAGE.width) })}
${propertyMetaHtml({ property: 'og:image:height', content: String(OPEN_GRAPH_IMAGE.height) })}
${propertyMetaHtml({ property: 'og:image:alt', content: OPEN_GRAPH_IMAGE.alt })}
<meta name="twitter:card" content="${TWITTER_CARD}">
<script type="application/ld+json">${structuredData}</script>
`;
}

function pageHeadHtml(document: SiteDocument): string {
  if (document.kind === SitePageKind.Public) return publicHeadHtml({ ...document, language: document.preferences.language });
  if (document.alternatePath === undefined) return '';
  return `${alternateLinksHtml(document.alternatePath)}\n`;
}

function themeAttributeOf(theme: Theme): string {
  if (theme === Theme.System) return '';
  return ` data-theme="${theme}"`;
}

function colorSchemeOf(theme: Theme): string {
  if (theme === Theme.System) return SYSTEM_COLOR_SCHEME;
  return theme;
}

function themeColorHtml(theme: Theme): string {
  const lightColor = `<meta name="theme-color" content="${LIGHT_THEME_COLOR}" media="(prefers-color-scheme: light)">`;
  const darkColor = `<meta name="theme-color" content="${DARK_THEME_COLOR}" media="(prefers-color-scheme: dark)">`;
  if (theme === Theme.Light) return `<meta name="theme-color" content="${LIGHT_THEME_COLOR}">`;
  if (theme === Theme.Dark) return `<meta name="theme-color" content="${DARK_THEME_COLOR}">`;
  return `${lightColor}\n${darkColor}`;
}

export function siteDocumentHtml(document: SiteDocument): string {
  const { title, description, main, scripts, preferences } = document;
  const { language, theme } = preferences;
  return `<!doctype html>
<html lang="${LANGUAGE_PROFILES[language].htmlLang}"${themeAttributeOf(theme)}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapedHtml(title)}</title>
<meta name="description" content="${escapedHtml(description)}">
<meta name="color-scheme" content="${colorSchemeOf(theme)}">
${themeColorHtml(theme)}
${iconLinksHtml()}
${pageHeadHtml(document)}<style>${SITE_STYLE}</style>
</head>
<body>
${SITE_GLYPH_SPRITE}
<a class="skip-link" href="#${CONTENT_ID}">${escapedHtml(LANDING_COPY_BY_LANGUAGE[language].shell.skipLink)}</a>
${headerHtml(preferences)}
${main}
${footerHtml(document)}${scriptsHtml(scripts)}
</body>
</html>
`;
}
