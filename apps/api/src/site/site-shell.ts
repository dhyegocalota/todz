import { COMPANY, REPOSITORY } from '@todz/types';
import { escapedHtml } from '../escaped-html';
import { LANDING_COPY } from './landing-copy';
import { DOCS_SELF_HOST_URL } from './self-host-redirect';
import { SITE_GLYPH_SPRITE, SiteGlyph, glyphHtml } from './site-glyphs';
import { DARK_THEME_COLOR } from './site-constants';
import { OPEN_GRAPH_IMAGE, SITE_ICONS, SiteIcon } from './site-icons';
import { SITE_STYLE } from './site-style';
import { starPillHtml } from './star-pill';
import { DOCS_INSTALL_URL, DiscoveryPath, SITE_URL } from './site-urls';

export const LANDING_PATH = '/';
export const CONTENT_ID = 'content';
const LIGHT_THEME_COLOR = '#F2F4FA';
const OPEN_GRAPH_TYPE = 'website';
const TWITTER_CARD = 'summary_large_image';

export enum SitePageKind {
  Public = 'public',
  Private = 'private',
}

type SiteDocumentContent = { title: string; description: string; main: string; scripts: string[] };

export type SiteDocument =
  | (SiteDocumentContent & { kind: SitePageKind.Public; path: string; structuredData: string; stars: number | null })
  | (SiteDocumentContent & { kind: SitePageKind.Private });

function brandHtml(): string {
  return `<a class="brand" href="${LANDING_PATH}" aria-label="${escapedHtml(LANDING_COPY.shell.homeLabel)}">${glyphHtml({ glyph: SiteGlyph.Icon, className: 'brand-icon' })}<span class="wordmark">${escapedHtml(LANDING_COPY.shell.wordmark)}</span></a>`;
}

function headerHtml(): string {
  return `<header class="site-header">
<div class="site-header-inner page-width">
${brandHtml()}
<nav class="site-nav" aria-label="${escapedHtml(LANDING_COPY.shell.navLabel)}">
<a class="nav-link" href="${DOCS_SELF_HOST_URL}"><span class="label-long">${escapedHtml(LANDING_COPY.shell.selfHostLink)}</span><span class="label-short">${escapedHtml(LANDING_COPY.shell.selfHostLinkShort)}</span></a>
<a class="nav-link" href="${DOCS_INSTALL_URL}"><span class="label-long">${escapedHtml(LANDING_COPY.shell.installLink)}</span><span class="label-short">${escapedHtml(LANDING_COPY.shell.installLinkShort)}</span></a>
</nav>
</div>
</header>`;
}

function creditHtml(): string {
  const { creditPrefix, creditLead, creditName, creditTail } = LANDING_COPY.shell;
  return `<p class="footer-credit">${escapedHtml(creditPrefix)} ${escapedHtml(creditLead)} <a class="footer-credit-link" href="${escapedHtml(COMPANY.website)}" rel="noopener noreferrer">${escapedHtml(creditName)}</a>${escapedHtml(creditTail)}</p>`;
}

function starPillFooterHtml(document: SiteDocument): string {
  if (document.kind === SitePageKind.Private) return '';
  return `${starPillHtml(document.stars)}\n`;
}

function sourceLinksHtml(document: SiteDocument): string {
  if (document.kind === SitePageKind.Private) return '';
  const { license, contributing } = LANDING_COPY.openSource;
  return `<a class="footer-link footer-open-source" href="${REPOSITORY.licenseUrl}" rel="noopener">${escapedHtml(license)}</a>
<a class="footer-link footer-open-source" href="${REPOSITORY.contributingUrl}" rel="noopener">${escapedHtml(contributing)}</a>
`;
}

function footerHtml(document: SiteDocument): string {
  return `<footer class="site-footer">
<div class="site-footer-inner page-width">
${brandHtml()}
${creditHtml()}
${starPillFooterHtml(document)}<div class="footer-links">
${sourceLinksHtml(document)}<a class="footer-link" href="${DOCS_SELF_HOST_URL}">${escapedHtml(LANDING_COPY.shell.footerSelfHost)}</a>
<a class="footer-link" href="${DOCS_INSTALL_URL}">${escapedHtml(LANDING_COPY.shell.footerInstall)}</a>
</div>
</div>
</footer>`;
}

function scriptsHtml(scripts: string[]): string {
  return scripts.map((script) => `\n<script>${script}</script>`).join('');
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

function publicHeadHtml({
  title,
  description,
  path,
  structuredData,
}: {
  title: string;
  description: string;
  path: string;
  structuredData: string;
}): string {
  const pageUrl = `${SITE_URL}${path}`;
  return `<link rel="canonical" href="${escapedHtml(pageUrl)}">
<link rel="apple-touch-icon" href="${SITE_ICONS[SiteIcon.AppleTouch].path}">
<link rel="manifest" href="${DiscoveryPath.Manifest}">
${propertyMetaHtml({ property: 'og:title', content: title })}
${propertyMetaHtml({ property: 'og:description', content: description })}
${propertyMetaHtml({ property: 'og:url', content: pageUrl })}
${propertyMetaHtml({ property: 'og:type', content: OPEN_GRAPH_TYPE })}
${propertyMetaHtml({ property: 'og:site_name', content: LANDING_COPY.meta.siteName })}
${propertyMetaHtml({ property: 'og:image', content: `${SITE_URL}${OPEN_GRAPH_IMAGE.path}` })}
${propertyMetaHtml({ property: 'og:image:width', content: String(OPEN_GRAPH_IMAGE.width) })}
${propertyMetaHtml({ property: 'og:image:height', content: String(OPEN_GRAPH_IMAGE.height) })}
${propertyMetaHtml({ property: 'og:image:alt', content: OPEN_GRAPH_IMAGE.alt })}
<meta name="twitter:card" content="${TWITTER_CARD}">
<script type="application/ld+json">${structuredData}</script>
`;
}

function pageHeadHtml(document: SiteDocument): string {
  if (document.kind === SitePageKind.Private) return '';
  return publicHeadHtml(document);
}

export function siteDocumentHtml(document: SiteDocument): string {
  const { title, description, main, scripts } = document;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapedHtml(title)}</title>
<meta name="description" content="${escapedHtml(description)}">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="${LIGHT_THEME_COLOR}" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="${DARK_THEME_COLOR}" media="(prefers-color-scheme: dark)">
${iconLinksHtml()}
${pageHeadHtml(document)}<style>${SITE_STYLE}</style>
</head>
<body>
${SITE_GLYPH_SPRITE}
<a class="skip-link" href="#${CONTENT_ID}">${escapedHtml(LANDING_COPY.shell.skipLink)}</a>
${headerHtml()}
${main}
${footerHtml(document)}${scriptsHtml(scripts)}
</body>
</html>
`;
}
