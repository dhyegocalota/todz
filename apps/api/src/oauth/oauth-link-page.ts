import { Language } from '@todz/types';
import { escapedHtml } from '../escaped-html';
import { HttpHeader } from '../http-header';
import { HttpStatus } from '../http-status';
import { OwnerErrorCode } from '../owner-errors';
import { MediaType } from '../request-body';
import { adminCardMainHtml } from '../site/admin-page';
import { siteContentSecurityPolicy } from '../site/site-headers';
import { SitePageKind, siteDocumentHtml } from '../site/site-shell';
import { SITE_STYLE } from '../site/site-style';
import { DOCS_SELF_HOST_PAGE, docsUrlOf } from '../site/site-urls';
import { OAUTH_COPY_BY_LANGUAGE, type OAuthCopy } from './oauth-copy';
import { oauthPageAnswerOf, oauthPreferencesOf } from './oauth-pages';
import { OAuthField, OAuthPath } from './oauth-paths';

const STATUS_ID = 'link-status';
const TITLE_ID = 'link-title';
const BODY_ID = 'link-body';
const RETRY_ID = 'link-retry';
const WORKING_STATE = 'working';
const FAILED_STATE = 'failed';
const SAME_ORIGIN_CREDENTIALS = 'same-origin';

function pageScriptOf({ copy, language }: { copy: OAuthCopy; language: Language }): string {
  return `{
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
  const fail = () => show(${JSON.stringify(copy.link.failedTitle)}, ${JSON.stringify(copy.link.failedBody)});
  const refused = (answer) => answer.error === '${OwnerErrorCode.CloudFull}'
    ? show(${JSON.stringify(copy.link.cloudFullTitle)}, ${JSON.stringify(copy.link.cloudFullBodyOf({ selfHostUrl: docsUrlOf({ language, page: DOCS_SELF_HOST_PAGE }) }))})
    : fail();
  const spent = (response) => {
    const isSignedIn = response.status === ${HttpStatus.Created} && request !== null;
    if (isSignedIn) return location.replace('${OAuthPath.Authorize}?' + request);
    response.json().then(refused).catch(fail);
  };
  status.dataset.state = '${WORKING_STATE}';
  title.textContent = ${JSON.stringify(copy.link.working)};
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
}

type LinkPage = { script: string; contentSecurityPolicy: string };

async function linkPageOf(language: Language): Promise<[Language, LinkPage]> {
  const script = pageScriptOf({ copy: OAUTH_COPY_BY_LANGUAGE[language], language });
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

function linkPageHtml({ request, script, copy }: { request: Request; script: string; copy: OAuthCopy }): string {
  return siteDocumentHtml({
    kind: SitePageKind.Private,
    title: copy.meta.linkTitle,
    description: copy.meta.description,
    main: adminCardMainHtml(`<div id="${STATUS_ID}" class="link-status" role="status" aria-live="polite" data-answer>
<h1 id="${TITLE_ID}" class="admin-title"></h1>
<p id="${BODY_ID}" class="admin-body"></p>
<a id="${RETRY_ID}" class="admin-link" hidden>${escapedHtml(copy.link.failedAction)}</a>
</div>
<noscript>
<h1 class="admin-title">${escapedHtml(copy.link.noScriptTitle)}</h1>
<p class="admin-body">${escapedHtml(copy.link.noScript)}</p>
</noscript>`),
    scripts: [script],
    preferences: oauthPreferencesOf({ request }),
  });
}

// NB ADR 0109: the page never receives the token, and it returns only to the authorize path of this server.
export async function serveOAuthLinkPage({ request }: { request: Request }): Promise<Response> {
  const { language } = oauthPreferencesOf({ request });
  const page = LINK_PAGES.get(language);
  if (page === undefined) throw new Error(`no link page for ${language}`);
  const html = linkPageHtml({ request, script: page.script, copy: OAUTH_COPY_BY_LANGUAGE[language] });
  return oauthPageAnswerOf({ html, status: HttpStatus.Ok, policy: page.contentSecurityPolicy });
}
