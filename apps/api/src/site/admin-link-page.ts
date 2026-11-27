import { Language } from '@todz/types';
import { escapedHtml } from '../escaped-html';
import { HttpHeader } from '../http-header';
import { HttpStatus } from '../http-status';
import { MediaType } from '../request-body';
import { ADMIN_COPY_BY_LANGUAGE, type AdminCopy } from './admin-copy';
import { adminCardMainHtml } from './admin-page';
import { AdminField, AdminPath } from './admin-paths';
import { adminPreferencesOf } from './admin-preferences';
import { adminPageResponse, siteContentSecurityPolicy } from './site-headers';
import { SitePageKind, siteDocumentHtml } from './site-shell';
import { SITE_STYLE } from './site-style';

const STATUS_ID = 'link-status';
const TITLE_ID = 'link-title';
const BODY_ID = 'link-body';
const RETRY_ID = 'link-retry';
const WORKING_STATE = 'working';
const FAILED_STATE = 'failed';
const SAME_ORIGIN_CREDENTIALS = 'same-origin';

function pageScriptOf(copy: AdminCopy): string {
  return `{
  const status = document.getElementById('${STATUS_ID}');
  const title = document.getElementById('${TITLE_ID}');
  const body = document.getElementById('${BODY_ID}');
  const retry = document.getElementById('${RETRY_ID}');
  const fail = () => {
    status.dataset.state = '${FAILED_STATE}';
    title.textContent = ${JSON.stringify(copy.link.failedTitle)};
    body.textContent = ${JSON.stringify(copy.link.failedBody)};
    retry.hidden = false;
  };
  const spent = (response) => response.status === ${HttpStatus.Created} ? location.replace('${AdminPath.Panel}') : fail();
  const spend = () => {
    const token = new URLSearchParams(location.hash.slice(1)).get('${AdminField.Token}');
    history.replaceState(null, '', location.pathname);
    status.dataset.state = '${WORKING_STATE}';
    title.textContent = ${JSON.stringify(copy.link.working)};
    body.textContent = '';
    retry.hidden = true;
    const answer = token === null
      ? Promise.reject(new Error('the link carries no token'))
      : fetch('${AdminPath.Sessions}', {
          method: 'POST',
          credentials: '${SAME_ORIGIN_CREDENTIALS}',
          headers: { '${HttpHeader.ContentType}': '${MediaType.Json}' },
          body: JSON.stringify({ ${AdminField.Token}: token }),
        });
    answer.then(spent).catch(fail);
  };
  spend();
  addEventListener('hashchange', spend);
}`;
}

type LinkPage = { script: string; contentSecurityPolicy: string };

async function linkPageOf(language: Language): Promise<[Language, LinkPage]> {
  const script = pageScriptOf(ADMIN_COPY_BY_LANGUAGE[language]);
  const contentSecurityPolicy = await siteContentSecurityPolicy({
    style: SITE_STYLE,
    scripts: [script],
    widgetOrigin: null,
    connectsToSelf: true,
    declaresManifest: false,
  });
  return [language, { script, contentSecurityPolicy }];
}

const LINK_PAGES = new Map<Language, LinkPage>(await Promise.all(Object.values(Language).map(linkPageOf)));

function linkPageHtml({ request, script, copy }: { request: Request; script: string; copy: AdminCopy }): string {
  return siteDocumentHtml({
    kind: SitePageKind.Private,
    title: copy.meta.linkTitle,
    description: copy.meta.description,
    main: adminCardMainHtml(`<div id="${STATUS_ID}" class="link-status" role="status" aria-live="polite" data-answer>
<h1 id="${TITLE_ID}" class="admin-title"></h1>
<p id="${BODY_ID}" class="admin-body"></p>
<a id="${RETRY_ID}" class="admin-link" href="${AdminPath.Panel}" hidden>${escapedHtml(copy.link.failedAction)}</a>
</div>
<noscript>
<h1 class="admin-title">${escapedHtml(copy.link.noScriptTitle)}</h1>
<p class="admin-body">${escapedHtml(copy.link.noScript)}</p>
</noscript>`),
    scripts: [script],
    preferences: adminPreferencesOf({ request }),
  });
}

export async function serveAdminLinkPage({ request }: { request: Request }): Promise<Response> {
  const { language } = adminPreferencesOf({ request });
  const page = LINK_PAGES.get(language);
  if (page === undefined) throw new Error(`no link page for ${language}`);
  const html = linkPageHtml({ request, script: page.script, copy: ADMIN_COPY_BY_LANGUAGE[language] });
  return adminPageResponse({ html, contentSecurityPolicy: page.contentSecurityPolicy });
}
