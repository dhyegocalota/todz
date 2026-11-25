import { escapedHtml } from '../escaped-html';
import { SELF_HOST_HTML } from './generated/self-host-html';
import { LANDING_COPY } from './landing-copy';
import { siteContentSecurityPolicy, sitePageResponse } from './site-headers';
import { SITE_STRUCTURED_DATA } from './site-json-ld';
import { CONTENT_ID, SELF_HOST_PATH, SitePageKind, siteDocumentHtml } from './site-shell';
import { SITE_STYLE } from './site-style';

const CONTENT_SECURITY_POLICY = await siteContentSecurityPolicy({
  style: SITE_STYLE,
  scripts: [SITE_STRUCTURED_DATA],
  widgetOrigin: null,
  connectsToSelf: false,
});

const SELF_HOST_PAGE_HTML = siteDocumentHtml({
  kind: SitePageKind.Public,
  path: SELF_HOST_PATH,
  structuredData: SITE_STRUCTURED_DATA,
  title: LANDING_COPY.selfHost.title,
  description: LANDING_COPY.selfHost.description,
  main: `<main id="${CONTENT_ID}" class="guide">
<article class="prose">
<p class="eyebrow-pill glass">${escapedHtml(LANDING_COPY.selfHost.eyebrow)}</p>
${SELF_HOST_HTML}
<p class="back-to-top"><a href="#${CONTENT_ID}">${escapedHtml(LANDING_COPY.selfHost.backToTop)}</a></p>
</article>
</main>`,
  scripts: [],
});

export async function serveSelfHostPage(): Promise<Response> {
  return sitePageResponse({ html: SELF_HOST_PAGE_HTML, contentSecurityPolicy: CONTENT_SECURITY_POLICY });
}
