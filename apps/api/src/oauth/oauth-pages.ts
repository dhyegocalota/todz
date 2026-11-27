import type { WorkspaceListing } from '../directory-workspaces';
import { escapedHtml } from '../escaped-html';
import { HttpHeader } from '../http-header';
import { HttpStatus } from '../http-status';
import { TurnstileAction } from '../turnstile';
import { TURNSTILE_ORIGIN, TURNSTILE_SCRIPT_TAG } from '../turnstile-page';
import {
  JOIN_BUTTON_CLASS,
  JOIN_FORM_CLASS,
  PAGE_SCRIPT,
  TOKEN_CALLBACK,
  WIDGET_APPEARANCE,
  WIDGET_CLASS,
  WIDGET_THEME,
  adminCardMainHtml,
  answerTitleHtml,
  noticeHtml,
} from '../site/admin-page';
import { adminPageResponse, siteContentSecurityPolicy, withFormOrigin } from '../site/site-headers';
import { SitePageKind, siteDocumentHtml } from '../site/site-shell';
import { SITE_STYLE } from '../site/site-style';
import type { AuthorizationRequest } from './oauth-authorization-request';
import { OAUTH_COPY } from './oauth-copy';
import { OAuthDecision, OAuthField, OAuthPath } from './oauth-paths';
import { isLoopbackRedirectUri, redirectHostOf, redirectOriginOf } from './oauth-redirect-uri';
import { OAuthScope } from './oauth-scope';

const TITLE_ID = 'oauth-title';
const EMAIL_ID = 'oauth-email';

export enum OAuthNotice {
  None = 'none',
  InvalidAddress = 'invalid-address',
  TryAgain = 'try-again',
}

const TEXT_OF_NOTICE: Record<OAuthNotice, string | null> = {
  [OAuthNotice.None]: null,
  [OAuthNotice.InvalidAddress]: OAUTH_COPY.signIn.invalidAddress,
  [OAuthNotice.TryAgain]: OAUTH_COPY.signIn.tooMany,
};

const STATUS_OF_NOTICE: Record<OAuthNotice, HttpStatus> = {
  [OAuthNotice.None]: HttpStatus.Ok,
  [OAuthNotice.InvalidAddress]: HttpStatus.BadRequest,
  [OAuthNotice.TryAgain]: HttpStatus.TooManyRequests,
};

export enum OAuthRefusal {
  Invalid = 'invalid',
  Choice = 'choice',
  Forbidden = 'forbidden',
  Unavailable = 'unavailable',
  TryAgain = 'try-again',
}

type RefusalCard = { title: string; body: string | null; status: HttpStatus };

const CARD_OF_REFUSAL: Record<OAuthRefusal, RefusalCard> = {
  [OAuthRefusal.Invalid]: { title: OAUTH_COPY.refusal.invalidTitle, body: OAUTH_COPY.refusal.invalidBody, status: HttpStatus.BadRequest },
  [OAuthRefusal.Choice]: { title: OAUTH_COPY.refusal.choiceTitle, body: OAUTH_COPY.refusal.choiceBody, status: HttpStatus.BadRequest },
  [OAuthRefusal.Forbidden]: {
    title: OAUTH_COPY.refusal.forbiddenTitle,
    body: OAUTH_COPY.refusal.forbiddenBody,
    status: HttpStatus.Forbidden,
  },
  [OAuthRefusal.Unavailable]: { title: OAUTH_COPY.signIn.unavailable, body: null, status: HttpStatus.Unavailable },
  [OAuthRefusal.TryAgain]: { title: OAUTH_COPY.signIn.tooMany, body: null, status: HttpStatus.TooManyRequests },
};

const CONTENT_SECURITY_POLICY = await siteContentSecurityPolicy({
  style: SITE_STYLE,
  scripts: [PAGE_SCRIPT],
  widgetOrigin: null,
  connectsToSelf: false,
  declaresManifest: false,
});
const CHALLENGE_CONTENT_SECURITY_POLICY = await siteContentSecurityPolicy({
  style: SITE_STYLE,
  scripts: [PAGE_SCRIPT],
  widgetOrigin: TURNSTILE_ORIGIN,
  connectsToSelf: false,
  declaresManifest: false,
});

function documentOf({ title, content }: { title: string; content: string }): string {
  return siteDocumentHtml({
    kind: SitePageKind.Private,
    title,
    description: OAUTH_COPY.meta.description,
    main: adminCardMainHtml(content),
    scripts: [PAGE_SCRIPT],
  });
}

function hiddenInputHtml({ name, value }: { name: string; value: string }): string {
  return `<input type="hidden" name="${escapedHtml(name)}" value="${escapedHtml(value)}">`;
}

export function oauthPageAnswerOf({
  html,
  status,
  policy = CONTENT_SECURITY_POLICY,
  cookies = [],
}: {
  html: string;
  status: HttpStatus;
  policy?: string;
  cookies?: string[];
}): Response {
  const page = adminPageResponse({ html, contentSecurityPolicy: policy });
  const answer = new Response(page.body, { status, headers: page.headers });
  cookies.forEach((cookie) => answer.headers.append(HttpHeader.SetCookie, cookie));
  return answer;
}

export function refusalPageOf(refusal: OAuthRefusal): Response {
  const { title, body, status } = CARD_OF_REFUSAL[refusal];
  const bodyHtml = body === null ? '' : `\n<p class="admin-body">${escapedHtml(body)}</p>`;
  return oauthPageAnswerOf({
    html: documentOf({ title: OAUTH_COPY.meta.refusedTitle, content: `${answerTitleHtml(title)}${bodyHtml}` }),
    status,
  });
}

function widgetHtml(siteKey: string): string {
  return `<div class="${WIDGET_CLASS}" data-sitekey="${escapedHtml(siteKey)}" data-action="${TurnstileAction.RequestLink}" data-appearance="${WIDGET_APPEARANCE}" data-theme="${WIDGET_THEME}" data-callback="${TOKEN_CALLBACK}"></div>`;
}

// NB ADR 0046: the site key sits in a data attribute, so the page script stays one fixed source with one hash.
export function signInPageOf({
  clientName,
  params,
  notice,
  siteKey,
}: {
  clientName: string;
  params: URLSearchParams;
  notice: OAuthNotice;
  siteKey: string;
}): Response {
  const content = `<h1 id="${TITLE_ID}" class="admin-title">${escapedHtml(OAUTH_COPY.signIn.titleOf(clientName))}</h1>
<p class="admin-body">${escapedHtml(OAUTH_COPY.signIn.lead)}</p>
<form class="${JOIN_FORM_CLASS} admin-form" method="post" action="${OAuthPath.SignInLinks}">
${hiddenInputHtml({ name: OAuthField.Request, value: params.toString() })}
<div class="join-capsule">
<label class="visually-hidden" for="${EMAIL_ID}">${escapedHtml(OAUTH_COPY.signIn.emailLabel)}</label>
<input id="${EMAIL_ID}" class="join-input" name="${OAuthField.Email}" type="email" autocomplete="email" inputmode="email" placeholder="${escapedHtml(OAUTH_COPY.signIn.emailPlaceholder)}" required>
<button class="${JOIN_BUTTON_CLASS}" type="submit" data-submitting="${escapedHtml(OAUTH_COPY.signIn.submitting)}">${escapedHtml(OAUTH_COPY.signIn.submit)}</button>
</div>
${widgetHtml(siteKey)}
${noticeHtml(TEXT_OF_NOTICE[notice])}</form>
${TURNSTILE_SCRIPT_TAG}`;
  return oauthPageAnswerOf({
    html: documentOf({ title: OAUTH_COPY.meta.signInTitle, content }),
    status: STATUS_OF_NOTICE[notice],
    policy: CHALLENGE_CONTENT_SECURITY_POLICY,
  });
}

export function inboxPageOf(cookies: string[]): Response {
  const content = `${answerTitleHtml(OAUTH_COPY.inbox.title)}
<p class="admin-body">${escapedHtml(OAUTH_COPY.inbox.body)}</p>`;
  return oauthPageAnswerOf({ html: documentOf({ title: OAUTH_COPY.meta.inboxTitle, content }), status: HttpStatus.Ok, cookies });
}

function projectChoiceHtml({ id, name, isChecked }: { id: string; name: string; isChecked: boolean }): string {
  const checked = isChecked ? ' checked' : '';
  return `<label class="consent-choice"><input type="radio" name="${OAuthField.Choice}" value="${escapedHtml(id)}"${checked} required><span>${escapedHtml(name)}</span></label>`;
}

function workspaceChoicesHtml({ listings, firstProjectId }: { listings: WorkspaceListing[]; firstProjectId: string | null }): string {
  return listings
    .filter(({ projects }) => projects.length > 0)
    .map(({ workspace, projects }) =>
      [
        `<p class="consent-workspace">${escapedHtml(workspace.name)}</p>`,
        ...projects.map((project) => projectChoiceHtml({ id: project.id, name: project.name, isChecked: project.id === firstProjectId })),
      ].join('\n'),
    )
    .join('\n');
}

function ownerChoiceHtml(): string {
  return `<label class="consent-choice consent-owner"><input type="radio" name="${OAuthField.Choice}" value="${OAuthScope.Owner}" required><span>${escapedHtml(OAUTH_COPY.consent.ownerLabel)}<small class="consent-warning">${escapedHtml(OAUTH_COPY.consent.ownerWarning)}</small></span></label>`;
}

function redirectLineOf(redirectUri: string): string {
  const host = redirectHostOf(redirectUri);
  if (isLoopbackRedirectUri(redirectUri)) return OAUTH_COPY.consent.loopbackRedirectOf(host);
  return OAUTH_COPY.consent.redirectOf(host);
}

export function firstProjectIdOf(listings: WorkspaceListing[]): string | null {
  const [firstProject] = listings.flatMap(({ projects }) => projects);
  if (firstProject === undefined) return null;
  return firstProject.id;
}

// NB ADR 0109: one project is preselected and the owner scope never is; the form only reaches this server and the client's redirect origin.
export function consentPageOf({
  request,
  listings,
  formToken,
}: {
  request: AuthorizationRequest;
  listings: WorkspaceListing[];
  formToken: string;
}): Response {
  const { client, redirectUri, offeredScopes, params } = request;
  const firstProjectId = firstProjectIdOf(listings);
  const isProjectOffered = offeredScopes[OAuthScope.Project];
  const isProjectChoosable = isProjectOffered && firstProjectId !== null;
  const projectHint = `<p class="consent-warning">${escapedHtml(OAUTH_COPY.consent.projectHint)}</p>\n`;
  const projectChoices = isProjectChoosable ? `${projectHint}${workspaceChoicesHtml({ listings, firstProjectId })}` : '';
  const isWithoutProjects = isProjectOffered && firstProjectId === null;
  const noProjectsLine = isWithoutProjects ? `<p class="admin-body">${escapedHtml(OAUTH_COPY.consent.noProjects)}</p>` : '';
  const ownerChoice = offeredScopes[OAuthScope.Owner] ? ownerChoiceHtml() : '';
  const hiddenInputs = [...params.entries(), [OAuthField.FormToken, formToken]]
    .map(([name, value]) => hiddenInputHtml({ name: String(name), value: String(value) }))
    .join('\n');
  const content = `<h1 id="${TITLE_ID}" class="admin-title">${escapedHtml(OAUTH_COPY.consent.titleOf(client.name))}</h1>
<p class="admin-body">${escapedHtml(redirectLineOf(redirectUri))}</p>
<form class="consent-form" method="post" action="${OAuthPath.Authorize}">
${hiddenInputs}
<fieldset class="consent-choices">
<legend class="consent-legend">${escapedHtml(OAUTH_COPY.consent.legend)}</legend>
${noProjectsLine}${projectChoices}
${ownerChoice}
</fieldset>
<div class="consent-actions">
<button class="admin-action" type="submit" name="${OAuthField.Decision}" value="${OAuthDecision.Deny}" formnovalidate>${escapedHtml(OAUTH_COPY.consent.deny)}</button>
<button class="${JOIN_BUTTON_CLASS}" type="submit" name="${OAuthField.Decision}" value="${OAuthDecision.Approve}">${escapedHtml(OAUTH_COPY.consent.approve)}</button>
</div>
</form>`;
  return oauthPageAnswerOf({
    html: documentOf({ title: OAUTH_COPY.meta.consentTitle, content }),
    status: HttpStatus.Ok,
    policy: withFormOrigin({ policy: CONTENT_SECURITY_POLICY, origin: redirectOriginOf(redirectUri) }),
  });
}
