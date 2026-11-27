import type { WorkspaceListing } from '../directory-workspaces';
import { escapedHtml } from '../escaped-html';
import { HttpHeader } from '../http-header';
import { HttpStatus } from '../http-status';
import { type PagePreferences, privatePagePreferencesOf } from '../page-preferences';
import { TurnstileAction } from '../turnstile';
import { TURNSTILE_ORIGIN, TURNSTILE_SCRIPT_TAG } from '../turnstile-page';
import {
  JOIN_BUTTON_CLASS,
  JOIN_FORM_CLASS,
  PAGE_SCRIPT,
  RETURN_ATTRIBUTE,
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
import { OAUTH_COPY_BY_LANGUAGE, type OAuthCopy } from './oauth-copy';
import { OAuthDecision, OAuthField, OAuthPath } from './oauth-paths';
import { isLoopbackRedirectUri, redirectHostOf, redirectOriginOf } from './oauth-redirect-uri';
import { OAuthScope } from './oauth-scope';

const TITLE_ID = 'oauth-title';
const WORKSPACE_PROJECT_SEPARATOR = ' › ';
const EMAIL_ID = 'oauth-email';

export enum OAuthNotice {
  None = 'none',
  InvalidAddress = 'invalid-address',
  TryAgain = 'try-again',
}

function textOfNotice({ notice, copy }: { notice: OAuthNotice; copy: OAuthCopy }): string | null {
  const texts: Record<OAuthNotice, string | null> = {
    [OAuthNotice.None]: null,
    [OAuthNotice.InvalidAddress]: copy.signIn.invalidAddress,
    [OAuthNotice.TryAgain]: copy.signIn.tooMany,
  };
  return texts[notice];
}

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

function cardOfRefusal({ refusal, copy }: { refusal: OAuthRefusal; copy: OAuthCopy }): RefusalCard {
  const cards: Record<OAuthRefusal, RefusalCard> = {
    [OAuthRefusal.Invalid]: { title: copy.refusal.invalidTitle, body: copy.refusal.invalidBody, status: HttpStatus.BadRequest },
    [OAuthRefusal.Choice]: { title: copy.refusal.choiceTitle, body: copy.refusal.choiceBody, status: HttpStatus.BadRequest },
    [OAuthRefusal.Forbidden]: { title: copy.refusal.forbiddenTitle, body: copy.refusal.forbiddenBody, status: HttpStatus.Forbidden },
    [OAuthRefusal.Unavailable]: { title: copy.signIn.unavailable, body: null, status: HttpStatus.Unavailable },
    [OAuthRefusal.TryAgain]: { title: copy.signIn.tooMany, body: null, status: HttpStatus.TooManyRequests },
  };
  return cards[refusal];
}

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

type OAuthPage = { copy: OAuthCopy; preferences: PagePreferences };

export function oauthPreferencesOf({ request, returnPath }: { request: Request; returnPath?: string }): PagePreferences {
  const preferences = privatePagePreferencesOf({ request });
  if (returnPath === undefined) return preferences;
  return { ...preferences, returnPath };
}

function oauthPageOf({ request, returnPath }: { request: Request; returnPath?: string }): OAuthPage {
  const preferences = oauthPreferencesOf({ request, returnPath });
  return { copy: OAUTH_COPY_BY_LANGUAGE[preferences.language], preferences };
}

function authorizePathOf(params: URLSearchParams): string {
  return `${OAuthPath.Authorize}?${params.toString()}`;
}

function documentOf({ title, content, page }: { title: string; content: string; page: OAuthPage }): string {
  return siteDocumentHtml({
    kind: SitePageKind.Private,
    title,
    description: page.copy.meta.description,
    main: adminCardMainHtml(content),
    scripts: [PAGE_SCRIPT],
    preferences: page.preferences,
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

export function refusalPageOf({ request, refusal }: { request: Request; refusal: OAuthRefusal }): Response {
  const page = oauthPageOf({ request });
  const { title, body, status } = cardOfRefusal({ refusal, copy: page.copy });
  const bodyHtml = body === null ? '' : `\n<p class="admin-body">${escapedHtml(body)}</p>`;
  return oauthPageAnswerOf({
    html: documentOf({ title: page.copy.meta.refusedTitle, content: `${answerTitleHtml(title)}${bodyHtml}`, page }),
    status,
  });
}

function widgetHtml(siteKey: string): string {
  return `<div class="${WIDGET_CLASS}" data-sitekey="${escapedHtml(siteKey)}" data-action="${TurnstileAction.RequestLink}" data-appearance="${WIDGET_APPEARANCE}" data-theme="${WIDGET_THEME}" data-callback="${TOKEN_CALLBACK}"></div>`;
}

// NB ADR 0046: the site key sits in a data attribute, so the page script stays one fixed source with one hash.
export function signInPageOf({
  request,
  clientName,
  params,
  notice,
  siteKey,
}: {
  request: Request;
  clientName: string;
  params: URLSearchParams;
  notice: OAuthNotice;
  siteKey: string;
}): Response {
  const page = oauthPageOf({ request, returnPath: authorizePathOf(params) });
  const { copy } = page;
  const content = `<h1 id="${TITLE_ID}" class="admin-title">${escapedHtml(copy.signIn.titleOf(clientName))}</h1>
<p class="admin-body">${escapedHtml(copy.signIn.lead)}</p>
<form class="${JOIN_FORM_CLASS} admin-form" method="post" action="${OAuthPath.SignInLinks}">
${hiddenInputHtml({ name: OAuthField.Request, value: params.toString() })}
<div class="join-capsule">
<label class="visually-hidden" for="${EMAIL_ID}">${escapedHtml(copy.signIn.emailLabel)}</label>
<input id="${EMAIL_ID}" class="join-input" name="${OAuthField.Email}" type="email" autocomplete="email" inputmode="email" placeholder="${escapedHtml(copy.signIn.emailPlaceholder)}" required>
<button class="${JOIN_BUTTON_CLASS}" type="submit" data-submitting="${escapedHtml(copy.signIn.submitting)}">${escapedHtml(copy.signIn.submit)}</button>
</div>
${widgetHtml(siteKey)}
${noticeHtml(textOfNotice({ notice, copy }))}</form>
${TURNSTILE_SCRIPT_TAG}`;
  return oauthPageAnswerOf({
    html: documentOf({ title: copy.meta.signInTitle, content, page }),
    status: STATUS_OF_NOTICE[notice],
    policy: CHALLENGE_CONTENT_SECURITY_POLICY,
  });
}

// NB ADR 0116: a decision answers a page that leaves for the client by a plain navigation, since form-action would block any later redirect of the client's own.
export function returnPageOf({ request, clientName, location }: { request: Request; clientName: string; location: string }): Response {
  const page = oauthPageOf({ request });
  const { copy } = page;
  const content = `${answerTitleHtml(copy.return.titleOf(clientName))}
<p class="admin-body">${escapedHtml(copy.return.body)}</p>
<a class="admin-link" href="${escapedHtml(location)}" ${RETURN_ATTRIBUTE}>${escapedHtml(copy.return.actionOf(clientName))}</a>`;
  return oauthPageAnswerOf({ html: documentOf({ title: copy.meta.returnTitle, content, page }), status: HttpStatus.Ok });
}

export function approvedPageOf({ request, clientName }: { request: Request; clientName: string }): Response {
  const page = oauthPageOf({ request });
  const { copy } = page;
  const content = `${answerTitleHtml(copy.approved.title)}
<p class="admin-body">${escapedHtml(copy.approved.bodyOf(clientName))}</p>`;
  return oauthPageAnswerOf({ html: documentOf({ title: copy.meta.approvedTitle, content, page }), status: HttpStatus.Ok });
}

export function inboxPageOf({ request, cookies }: { request: Request; cookies: string[] }): Response {
  const page = oauthPageOf({ request });
  const { copy } = page;
  const content = `${answerTitleHtml(copy.inbox.title)}
<p class="admin-body">${escapedHtml(copy.inbox.body)}</p>`;
  return oauthPageAnswerOf({ html: documentOf({ title: copy.meta.inboxTitle, content, page }), status: HttpStatus.Ok, cookies });
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
        ...projects.map((project) =>
          projectChoiceHtml({
            id: project.id,
            name: `${workspace.name}${WORKSPACE_PROJECT_SEPARATOR}${project.name}`,
            isChecked: project.id === firstProjectId,
          }),
        ),
      ].join('\n'),
    )
    .join('\n');
}

function ownerChoiceHtml(copy: OAuthCopy): string {
  return `<label class="consent-choice consent-owner"><input type="radio" name="${OAuthField.Choice}" value="${OAuthScope.Owner}" required><span>${escapedHtml(copy.consent.ownerLabel)}<small class="consent-warning">${escapedHtml(copy.consent.ownerWarning)}</small></span></label>`;
}

function redirectLineOf({ redirectUri, copy }: { redirectUri: string; copy: OAuthCopy }): string {
  const host = redirectHostOf(redirectUri);
  if (isLoopbackRedirectUri(redirectUri)) return copy.consent.loopbackRedirectOf(host);
  return copy.consent.redirectOf(host);
}

export function firstProjectIdOf(listings: WorkspaceListing[]): string | null {
  const [firstProject] = listings.flatMap(({ projects }) => projects);
  if (firstProject === undefined) return null;
  return firstProject.id;
}

// NB ADR 0109: one project is preselected and the owner scope never is; the form only reaches this server and the client's redirect origin.
export function consentPageOf({
  request,
  authorization,
  listings,
  formToken,
}: {
  request: Request;
  authorization: AuthorizationRequest;
  listings: WorkspaceListing[];
  formToken: string;
}): Response {
  const { client, redirectUri, offeredScopes, params } = authorization;
  const page = oauthPageOf({ request, returnPath: authorizePathOf(params) });
  const { copy } = page;
  const firstProjectId = firstProjectIdOf(listings);
  const isProjectOffered = offeredScopes[OAuthScope.Project];
  const isProjectChoosable = isProjectOffered && firstProjectId !== null;
  const projectHint = `<p class="consent-warning">${escapedHtml(copy.consent.projectHint)}</p>\n`;
  const projectChoices = isProjectChoosable ? `${projectHint}${workspaceChoicesHtml({ listings, firstProjectId })}` : '';
  const isWithoutProjects = isProjectOffered && firstProjectId === null;
  const noProjectsLine = isWithoutProjects ? `<p class="admin-body">${escapedHtml(copy.consent.noProjects)}</p>` : '';
  const ownerChoice = offeredScopes[OAuthScope.Owner] ? ownerChoiceHtml(copy) : '';
  const hiddenInputs = [...params.entries(), [OAuthField.FormToken, formToken]]
    .map(([name, value]) => hiddenInputHtml({ name: String(name), value: String(value) }))
    .join('\n');
  const content = `<h1 id="${TITLE_ID}" class="admin-title">${escapedHtml(copy.consent.titleOf(client.name))}</h1>
<p class="admin-body">${escapedHtml(redirectLineOf({ redirectUri, copy }))}</p>
<form class="${JOIN_FORM_CLASS} consent-form" method="post" action="${OAuthPath.Authorize}">
${hiddenInputs}
<fieldset class="consent-choices">
<legend class="consent-legend">${escapedHtml(copy.consent.legend)}</legend>
${noProjectsLine}${projectChoices}
${ownerChoice}
</fieldset>
<div class="consent-actions">
<button class="admin-action" type="submit" name="${OAuthField.Decision}" value="${OAuthDecision.Deny}" formnovalidate>${escapedHtml(copy.consent.deny)}</button>
<button class="${JOIN_BUTTON_CLASS}" type="submit" name="${OAuthField.Decision}" value="${OAuthDecision.Approve}" data-submitting="${escapedHtml(copy.consent.approving)}">${escapedHtml(copy.consent.approve)}</button>
</div>
</form>`;
  return oauthPageAnswerOf({
    html: documentOf({ title: copy.meta.consentTitle, content, page }),
    status: HttpStatus.Ok,
    policy: withFormOrigin({ policy: CONTENT_SECURITY_POLICY, origin: redirectOriginOf(redirectUri) }),
  });
}
