import type { WorkspaceListing } from '../directory-workspaces';
import { EMAIL_CODE_COPY_BY_LANGUAGE } from '../email-code-copy';
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
import { CodeState, EMAIL_CODE_SCRIPT, codeFormHtml, resendFormHtml } from '../site/email-code-input';
import { SitePageKind, siteDocumentHtml } from '../site/site-shell';
import { SITE_STYLE } from '../site/site-style';
import type { ProjectRecord, WorkspaceRecord } from '../owner-records';
import type { AuthorizationRequest } from './oauth-authorization-request';
import {
  CONSENT_GROUP_ATTRIBUTE,
  CONSENT_HIDE_LABEL_ATTRIBUTE,
  CONSENT_OWNER_ATTRIBUTE,
  CONSENT_PROJECTS_ATTRIBUTE,
  CONSENT_PROJECT_ATTRIBUTE,
  CONSENT_SCRIPT,
  CONSENT_SELECT_ALL_ATTRIBUTE,
  CONSENT_SELECT_ALL_ROW_ATTRIBUTE,
  CONSENT_SHOW_LABEL_ATTRIBUTE,
  CONSENT_SUMMARY_ATTRIBUTE,
  CONSENT_TOGGLE_ATTRIBUTE,
  CONSENT_TREE_ATTRIBUTE,
  CONSENT_WORDS_ATTRIBUTE,
  CONSENT_WORKSPACE_ATTRIBUTE,
  CONSENT_WORKSPACE_ID_ATTRIBUTE,
} from './oauth-consent-script';
import { OAUTH_COPY_BY_LANGUAGE, type OAuthCopy } from './oauth-copy';
import { GrantScopeKind } from './oauth-grant-scope';
import type { NamedScope } from './oauth-grant-scope-store';
import { OAuthDecision, OAuthField, OAuthPath } from './oauth-paths';
import { isLoopbackRedirectUri, redirectHostOf, redirectOriginOf } from './oauth-redirect-uri';
import { OAuthScope, wordOfScope } from './oauth-scope';

const TITLE_ID = 'oauth-title';
const WORKSPACE_PROJECT_SEPARATOR = ' › ';
const EMAIL_ID = 'oauth-email';
const CODE_ID = 'oauth-code';
const HOLDINGS_SEPARATOR = '; ';
const CODE_SCRIPTS = [PAGE_SCRIPT, EMAIL_CODE_SCRIPT];
const CONSENT_SCRIPTS = [PAGE_SCRIPT, CONSENT_SCRIPT];

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

const CONSENT_CONTENT_SECURITY_POLICY = await siteContentSecurityPolicy({
  style: SITE_STYLE,
  scripts: CONSENT_SCRIPTS,
  widgetOrigin: null,
  connectsToSelf: false,
  declaresManifest: false,
});

const CODE_CONTENT_SECURITY_POLICY = await siteContentSecurityPolicy({
  style: SITE_STYLE,
  scripts: CODE_SCRIPTS,
  widgetOrigin: TURNSTILE_ORIGIN,
  connectsToSelf: false,
  declaresManifest: false,
});

const STATUS_OF_CODE_STATE: Record<CodeState, HttpStatus> = {
  [CodeState.Wrong]: HttpStatus.Unauthorized,
  [CodeState.Locked]: HttpStatus.TooManyRequests,
};

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

function documentOf({
  title,
  content,
  page,
  hasControls,
  scripts = [PAGE_SCRIPT],
}: {
  title: string;
  content: string;
  page: OAuthPage;
  hasControls: boolean;
  scripts?: string[];
}): string {
  return siteDocumentHtml({
    kind: SitePageKind.Private,
    title,
    description: page.copy.meta.description,
    main: adminCardMainHtml(content),
    scripts,
    preferences: page.preferences,
    hasControls,
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
    html: documentOf({ title: page.copy.meta.refusedTitle, content: `${answerTitleHtml(title)}${bodyHtml}`, page, hasControls: false }),
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
<input id="${EMAIL_ID}" class="join-input" name="${OAuthField.Email}" type="email" autocomplete="email" inputmode="email" placeholder="${escapedHtml(copy.signIn.emailPlaceholder)}" required autofocus>
<button class="${JOIN_BUTTON_CLASS}" type="submit" data-submitting="${escapedHtml(copy.signIn.submitting)}">${escapedHtml(copy.signIn.submit)}</button>
</div>
${widgetHtml(siteKey)}
${noticeHtml(textOfNotice({ notice, copy }))}</form>
${TURNSTILE_SCRIPT_TAG}`;
  return oauthPageAnswerOf({
    html: documentOf({ title: copy.meta.signInTitle, content, page, hasControls: true }),
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
  return oauthPageAnswerOf({
    html: documentOf({ title: copy.meta.returnTitle, content, page, hasControls: false }),
    status: HttpStatus.Ok,
  });
}

export function approvedPageOf({ request, clientName }: { request: Request; clientName: string }): Response {
  const page = oauthPageOf({ request });
  const { copy } = page;
  const content = `${answerTitleHtml(copy.approved.title)}
<p class="admin-body">${escapedHtml(copy.approved.bodyOf(clientName))}</p>`;
  return oauthPageAnswerOf({
    html: documentOf({ title: copy.meta.approvedTitle, content, page, hasControls: false }),
    status: HttpStatus.Ok,
  });
}

export function inboxPageOf({
  request,
  cookies,
  address,
  params,
  siteKey,
  state,
}: {
  request: Request;
  cookies: string[];
  address: string;
  params: URLSearchParams;
  siteKey: string;
  state: CodeState | null;
}): Response {
  const page = oauthPageOf({ request });
  const { copy } = page;
  const codeCopy = EMAIL_CODE_COPY_BY_LANGUAGE[page.preferences.language];
  const fields = [
    { name: OAuthField.Email, value: address },
    { name: OAuthField.Request, value: params.toString() },
  ];
  const content = `<h1 id="${TITLE_ID}" class="admin-title">${escapedHtml(copy.inbox.title)}</h1>
<p class="admin-body">${escapedHtml(copy.inbox.body)}</p>
${codeFormHtml({ copy: codeCopy, action: OAuthPath.CodeSessions, fields, inputId: CODE_ID, state })}
${resendFormHtml({ copy: codeCopy, action: OAuthPath.SignInLinks, fields, widget: `${widgetHtml(siteKey)}\n` })}
${TURNSTILE_SCRIPT_TAG}`;
  return oauthPageAnswerOf({
    html: documentOf({ title: copy.meta.inboxTitle, content, page, hasControls: false, scripts: CODE_SCRIPTS }),
    status: state === null ? HttpStatus.Ok : STATUS_OF_CODE_STATE[state],
    policy: CODE_CONTENT_SECURITY_POLICY,
    cookies,
  });
}

function choiceBoxHtml({ value, attributes, labelHtml }: { value: string; attributes: string; labelHtml: string }): string {
  return `<label class="consent-choice"><input type="checkbox" name="${OAuthField.Choice}" value="${escapedHtml(value)}" ${attributes}>${labelHtml}</label>`;
}

function projectChoiceHtml({ project, workspace }: { project: ProjectRecord; workspace: WorkspaceRecord }): string {
  const label = `${workspace.name}${WORKSPACE_PROJECT_SEPARATOR}${project.name}`;
  return choiceBoxHtml({
    value: wordOfScope({ kind: GrantScopeKind.Project, projectId: project.id }),
    attributes: `${CONSENT_PROJECT_ATTRIBUTE} ${CONSENT_WORKSPACE_ID_ATTRIBUTE}="${escapedHtml(workspace.id)}"`,
    labelHtml: `<span>${escapedHtml(label)}</span>`,
  });
}

function workspaceGroupHtml({ listing, copy }: { listing: WorkspaceListing; copy: OAuthCopy }): string {
  const { workspace, projects } = listing;
  const workspaceBox = choiceBoxHtml({
    value: wordOfScope({ kind: GrantScopeKind.Workspace, workspaceId: workspace.id }),
    attributes: `${CONSENT_WORKSPACE_ATTRIBUTE} ${CONSENT_WORKSPACE_ID_ATTRIBUTE}="${escapedHtml(workspace.id)}"`,
    labelHtml: `<span>${escapedHtml(workspace.name)}<small class="consent-warning">${escapedHtml(copy.consent.workspaceIncludes)}</small></span>`,
  });
  const toggle = `<button class="admin-action consent-toggle" type="button" ${CONSENT_TOGGLE_ATTRIBUTE} ${CONSENT_SHOW_LABEL_ATTRIBUTE}="${escapedHtml(copy.consent.showProjects)}" ${CONSENT_HIDE_LABEL_ATTRIBUTE}="${escapedHtml(copy.consent.hideProjects)}" aria-expanded="true" hidden>${escapedHtml(copy.consent.hideProjects)}</button>`;
  return `<div class="consent-group" ${CONSENT_GROUP_ATTRIBUTE}>
<div class="consent-row">${workspaceBox}${toggle}</div>
<div class="consent-projects" ${CONSENT_PROJECTS_ATTRIBUTE}>
${projects.map((project) => projectChoiceHtml({ project, workspace })).join('\n')}
</div>
</div>`;
}

function summaryWordsOf(copy: OAuthCopy): Record<string, string> {
  return {
    none: copy.consent.summaryNone,
    account: copy.consent.accountName,
    workspaceOne: copy.consent.summaryWorkspaceOne,
    workspaceMany: copy.consent.summaryWorkspaceMany,
    projectOne: copy.consent.summaryProjectOne,
    projectMany: copy.consent.summaryProjectMany,
    both: copy.consent.summaryBoth,
  };
}

function selectionTreeHtml({ listings, copy }: { listings: WorkspaceListing[]; copy: OAuthCopy }): string {
  const selectAll = `<div ${CONSENT_SELECT_ALL_ROW_ATTRIBUTE} hidden><label class="consent-choice"><input type="checkbox" ${CONSENT_SELECT_ALL_ATTRIBUTE}><span>${escapedHtml(copy.consent.selectAll)}</span></label></div>`;
  const groups = listings.map((listing) => workspaceGroupHtml({ listing, copy })).join('\n');
  const summary = `<p class="consent-summary" aria-live="polite" ${CONSENT_SUMMARY_ATTRIBUTE} ${CONSENT_WORDS_ATTRIBUTE}="${escapedHtml(JSON.stringify(summaryWordsOf(copy)))}" hidden></p>`;
  return `<p class="consent-warning">${escapedHtml(copy.consent.selectionHint)}</p>
<div class="consent-tree" ${CONSENT_TREE_ATTRIBUTE}>
${selectAll}
${groups}
</div>
${summary}`;
}

function ownerChoiceHtml(copy: OAuthCopy): string {
  return `<label class="consent-choice consent-owner"><input type="checkbox" name="${OAuthField.Choice}" value="${OAuthScope.Owner}" ${CONSENT_OWNER_ATTRIBUTE}><span>${escapedHtml(copy.consent.ownerLabel)}<small class="consent-warning">${escapedHtml(copy.consent.ownerWarning)}</small></span></label>`;
}

function redirectLineOf({ redirectUri, copy }: { redirectUri: string; copy: OAuthCopy }): string {
  const host = redirectHostOf(redirectUri);
  if (isLoopbackRedirectUri(redirectUri)) return copy.consent.loopbackRedirectOf(host);
  return copy.consent.redirectOf(host);
}

function heldLabelOf({ scope, copy }: { scope: NamedScope; copy: OAuthCopy }): string {
  if (scope.kind === GrantScopeKind.Workspace) return scope.workspaceName;
  if (scope.kind === GrantScopeKind.Project) return `${scope.workspaceName}${WORKSPACE_PROJECT_SEPARATOR}${scope.projectName}`;
  return copy.consent.accountName;
}

function heldLineHtml({ clientName, held, copy }: { clientName: string; held: NamedScope[]; copy: OAuthCopy }): string {
  if (held.length === 0) return '';
  const isAccount = (scope: NamedScope) => scope.kind === GrantScopeKind.Account;
  const ordered = [...held.filter((scope) => !isAccount(scope)), ...held.filter(isAccount)];
  const labels = [...new Set(ordered.map((scope) => heldLabelOf({ scope, copy })))];
  return `<p class="consent-holds">${escapedHtml(copy.consent.holdsOf({ clientName, held: labels.join(HOLDINGS_SEPARATOR) }))}</p>\n`;
}

// NB ADR 0126: the page is a tree of plain checkboxes the form posts without script; the owner scope is never preselected and no task count is shown.
export function consentPageOf({
  request,
  authorization,
  listings,
  held,
  formToken,
}: {
  request: Request;
  authorization: AuthorizationRequest;
  listings: WorkspaceListing[];
  held: NamedScope[];
  formToken: string;
}): Response {
  const { client, redirectUri, offeredScopes, params } = authorization;
  const page = oauthPageOf({ request, returnPath: authorizePathOf(params) });
  const { copy } = page;
  const selectable = listings.filter(({ projects }) => projects.length > 0);
  const isProjectOffered = offeredScopes[OAuthScope.Project];
  const isSelectable = isProjectOffered && selectable.length > 0;
  const selectionTree = isSelectable ? selectionTreeHtml({ listings: selectable, copy }) : '';
  const isWithoutProjects = isProjectOffered && selectable.length === 0;
  const noProjectsLine = isWithoutProjects ? `<p class="admin-body">${escapedHtml(copy.consent.noProjects)}</p>` : '';
  const ownerChoice = offeredScopes[OAuthScope.Owner] ? ownerChoiceHtml(copy) : '';
  const hiddenInputs = [...params.entries(), [OAuthField.FormToken, formToken]]
    .map(([name, value]) => hiddenInputHtml({ name: String(name), value: String(value) }))
    .join('\n');
  const content = `<h1 id="${TITLE_ID}" class="admin-title">${escapedHtml(copy.consent.titleOf(client.name))}</h1>
<p class="admin-body">${escapedHtml(redirectLineOf({ redirectUri, copy }))}</p>
${heldLineHtml({ clientName: client.name, held, copy })}<form class="${JOIN_FORM_CLASS} consent-form" method="post" action="${OAuthPath.Authorize}">
${hiddenInputs}
<fieldset class="consent-choices">
<legend class="consent-legend">${escapedHtml(copy.consent.legend)}</legend>
${noProjectsLine}${selectionTree}
${ownerChoice}
</fieldset>
<div class="consent-actions">
<button class="admin-action" type="submit" name="${OAuthField.Decision}" value="${OAuthDecision.Deny}" formnovalidate>${escapedHtml(copy.consent.deny)}</button>
<button class="${JOIN_BUTTON_CLASS}" type="submit" name="${OAuthField.Decision}" value="${OAuthDecision.Approve}" data-submitting="${escapedHtml(copy.consent.approving)}">${escapedHtml(copy.consent.approve)}</button>
</div>
</form>`;
  return oauthPageAnswerOf({
    html: documentOf({ title: copy.meta.consentTitle, content, page, hasControls: true, scripts: CONSENT_SCRIPTS }),
    status: HttpStatus.Ok,
    policy: withFormOrigin({ policy: CONSENT_CONTENT_SECURITY_POLICY, origin: redirectOriginOf(redirectUri) }),
  });
}
