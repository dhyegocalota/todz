import { escapedHtml } from '../escaped-html';
import { HttpHeader } from '../http-header';
import { HttpStatus } from '../http-status';
import { OwnerErrorCode } from '../owner-errors';
import { MediaType } from '../request-body';
import { adminCardMainHtml } from '../site/admin-page';
import { siteContentSecurityPolicy } from '../site/site-headers';
import { SitePageKind, siteDocumentHtml } from '../site/site-shell';
import { SITE_STYLE } from '../site/site-style';
import { OAUTH_COPY } from './oauth-copy';
import { oauthPageAnswerOf } from './oauth-pages';
import { OAuthField, OAuthPath } from './oauth-paths';

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
  const fragment = new URLSearchParams(location.hash.slice(1));
  const token = fragment.get('${OAuthField.Token}');
  const request = fragment.get('${OAuthField.Request}');
  history.replaceState(null, '', location.pathname);
  const show = (titleText, bodyText) => {
    status.dataset.state = '${FAILED_STATE}';
    title.textContent = titleText;
    body.textContent = bodyText;
    retry.hidden = request === null;
    if (request !== null) retry.href = '${OAuthPath.Authorize}?' + request;
  };
  const fail = () => show(${JSON.stringify(OAUTH_COPY.link.failedTitle)}, ${JSON.stringify(OAUTH_COPY.link.failedBody)});
  const refused = (answer) => answer.error === '${OwnerErrorCode.CloudFull}'
    ? show(${JSON.stringify(OAUTH_COPY.link.cloudFullTitle)}, ${JSON.stringify(OAUTH_COPY.link.cloudFullBody)})
    : fail();
  const spent = (response) => {
    const isSignedIn = response.status === ${HttpStatus.Created} && request !== null;
    if (isSignedIn) return location.replace('${OAuthPath.Authorize}?' + request);
    response.json().then(refused).catch(fail);
  };
  status.dataset.state = '${WORKING_STATE}';
  title.textContent = ${JSON.stringify(OAUTH_COPY.link.working)};
  const answer = token === null
    ? Promise.reject(new Error('the link carries no token'))
    : fetch('${OAuthPath.Sessions}', {
        method: 'POST',
        credentials: '${SAME_ORIGIN_CREDENTIALS}',
        headers: { '${HttpHeader.ContentType}': '${MediaType.Json}' },
        body: JSON.stringify({ ${OAuthField.Token}: token, ${OAuthField.TimeZone}: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      });
  answer.then(spent).catch(fail);
}`;

const CONTENT_SECURITY_POLICY = await siteContentSecurityPolicy({
  style: SITE_STYLE,
  scripts: [PAGE_SCRIPT],
  widgetOrigin: null,
  connectsToSelf: true,
  declaresManifest: false,
});

const LINK_PAGE_HTML = siteDocumentHtml({
  kind: SitePageKind.Private,
  title: OAUTH_COPY.meta.linkTitle,
  description: OAUTH_COPY.meta.description,
  main: adminCardMainHtml(`<div id="${STATUS_ID}" class="link-status" role="status" aria-live="polite" data-answer>
<h1 id="${TITLE_ID}" class="admin-title"></h1>
<p id="${BODY_ID}" class="admin-body"></p>
<a id="${RETRY_ID}" class="admin-link" hidden>${escapedHtml(OAUTH_COPY.link.failedAction)}</a>
</div>
<noscript>
<h1 class="admin-title">${escapedHtml(OAUTH_COPY.link.noScriptTitle)}</h1>
<p class="admin-body">${escapedHtml(OAUTH_COPY.link.noScript)}</p>
</noscript>`),
  scripts: [PAGE_SCRIPT],
});

// NB ADR 0109: the page never receives the token, and it returns only to the authorize path of this server.
export async function serveOAuthLinkPage(): Promise<Response> {
  return oauthPageAnswerOf({ html: LINK_PAGE_HTML, status: HttpStatus.Ok, policy: CONTENT_SECURITY_POLICY });
}
