import { escapedHtml } from '../escaped-html';
import { HttpHeader } from '../http-header';
import { HttpStatus } from '../http-status';
import { MediaType } from '../request-body';
import { ADMIN_COPY } from './admin-copy';
import { adminCardMainHtml } from './admin-page';
import { AdminField, AdminPath } from './admin-paths';
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

const PAGE_SCRIPT = `{
  const status = document.getElementById('${STATUS_ID}');
  const title = document.getElementById('${TITLE_ID}');
  const body = document.getElementById('${BODY_ID}');
  const retry = document.getElementById('${RETRY_ID}');
  const fail = () => {
    status.dataset.state = '${FAILED_STATE}';
    title.textContent = ${JSON.stringify(ADMIN_COPY.link.failedTitle)};
    body.textContent = ${JSON.stringify(ADMIN_COPY.link.failedBody)};
    retry.hidden = false;
  };
  const spent = (response) => response.status === ${HttpStatus.Created} ? location.replace('${AdminPath.Panel}') : fail();
  const spend = () => {
    const token = new URLSearchParams(location.hash.slice(1)).get('${AdminField.Token}');
    history.replaceState(null, '', location.pathname);
    status.dataset.state = '${WORKING_STATE}';
    title.textContent = ${JSON.stringify(ADMIN_COPY.link.working)};
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

const CONTENT_SECURITY_POLICY = await siteContentSecurityPolicy({
  style: SITE_STYLE,
  scripts: [PAGE_SCRIPT],
  widgetOrigin: null,
  connectsToSelf: true,
});

const LINK_PAGE_HTML = siteDocumentHtml({
  kind: SitePageKind.Private,
  title: ADMIN_COPY.meta.linkTitle,
  description: ADMIN_COPY.meta.description,
  main: adminCardMainHtml(`<div id="${STATUS_ID}" class="link-status" role="status" aria-live="polite" data-answer>
<h1 id="${TITLE_ID}" class="admin-title"></h1>
<p id="${BODY_ID}" class="admin-body"></p>
<a id="${RETRY_ID}" class="admin-link" href="${AdminPath.Panel}" hidden>${escapedHtml(ADMIN_COPY.link.failedAction)}</a>
</div>
<noscript>
<h1 class="admin-title">${escapedHtml(ADMIN_COPY.link.noScriptTitle)}</h1>
<p class="admin-body">${escapedHtml(ADMIN_COPY.link.noScript)}</p>
</noscript>`),
  scripts: [PAGE_SCRIPT],
});

export async function serveAdminLinkPage(): Promise<Response> {
  return adminPageResponse({ html: LINK_PAGE_HTML, contentSecurityPolicy: CONTENT_SECURITY_POLICY });
}
