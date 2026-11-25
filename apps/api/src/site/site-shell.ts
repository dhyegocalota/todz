import { COMPANY } from '@todz/types';
import { escapedHtml } from '../escaped-html';
import { LANDING_COPY } from './landing-copy';
import { DOCS_SELF_HOST_URL } from './self-host-redirect';
import { SITE_GLYPH_SPRITE, SiteGlyph, glyphHtml } from './site-glyphs';
import { SITE_STYLE } from './site-style';

export const LANDING_PATH = '/';
export const JOIN_PATH = '/join';
export const CONTENT_ID = 'content';
const LIGHT_THEME_COLOR = '#F2F4FA';
const DARK_THEME_COLOR = '#070812';

export type SiteDocument = { title: string; description: string; main: string; script: string | null };

function brandHtml(): string {
  return `<a class="brand" href="${LANDING_PATH}" aria-label="${escapedHtml(LANDING_COPY.shell.homeLabel)}">${glyphHtml({ glyph: SiteGlyph.Icon, className: 'brand-icon' })}<span class="wordmark">${escapedHtml(LANDING_COPY.shell.wordmark)}</span></a>`;
}

function headerHtml(): string {
  return `<header class="site-header">
<div class="site-header-inner page-width">
${brandHtml()}
<nav class="site-nav" aria-label="${escapedHtml(LANDING_COPY.shell.navLabel)}">
<a class="nav-link" href="${DOCS_SELF_HOST_URL}"><span class="label-long">${escapedHtml(LANDING_COPY.shell.selfHostLink)}</span><span class="label-short">${escapedHtml(LANDING_COPY.shell.selfHostLinkShort)}</span></a>
</nav>
</div>
</header>`;
}

function creditHtml(): string {
  const { creditLead, creditName, creditTail } = LANDING_COPY.shell;
  return `<p class="footer-credit">${escapedHtml(creditLead)} <a class="footer-credit-link" href="${escapedHtml(COMPANY.website)}" rel="noopener noreferrer">${escapedHtml(creditName)}</a>${escapedHtml(creditTail)}</p>`;
}

function footerHtml(): string {
  return `<footer class="site-footer">
<div class="site-footer-inner page-width">
${brandHtml()}
<p class="footer-copyright">${escapedHtml(LANDING_COPY.shell.copyright)}</p>
${creditHtml()}
<a class="footer-link" href="${DOCS_SELF_HOST_URL}">${escapedHtml(LANDING_COPY.shell.footerSelfHost)}</a>
</div>
</footer>`;
}

function scriptHtml(script: string | null): string {
  if (script === null) return '';
  return `\n<script>${script}</script>`;
}

export function siteDocumentHtml({ title, description, main, script }: SiteDocument): string {
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
<style>${SITE_STYLE}</style>
</head>
<body>
${SITE_GLYPH_SPRITE}
<a class="skip-link" href="#${CONTENT_ID}">${escapedHtml(LANDING_COPY.shell.skipLink)}</a>
${headerHtml()}
${main}
${footerHtml()}${scriptHtml(script)}
</body>
</html>
`;
}
