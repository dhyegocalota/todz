import { EMAIL_CODE_COPY_BY_LANGUAGE, type EmailCodeCopy } from '../email-code-copy';
import { escapedHtml } from '../escaped-html';
import type { PagePreferences } from '../page-preferences';
import { TurnstileAction } from '../turnstile';
import { TURNSTILE_ORIGIN, TURNSTILE_RESPONSE_FIELD, TURNSTILE_SCRIPT_TAG, usableSiteKeyOf } from '../turnstile-page';
import { ADMIN_COPY_BY_LANGUAGE, type AdminCopy } from './admin-copy';
import { AdminNotice } from './admin-notice';
import { AdminField, AdminPath } from './admin-paths';
import { adminPreferencesOf } from './admin-preferences';
import { CodeState, EMAIL_CODE_SCRIPT, codeFormHtml, resendFormHtml } from './email-code-input';
import { JOIN_BUTTON_CLASS, JOIN_FORM_CLASS } from './join-form-classes';
import { SiteGlyph, glyphHtml } from './site-glyphs';
import { adminPageResponse, siteContentSecurityPolicy } from './site-headers';
import { CONTENT_ID, SitePageKind, siteDocumentHtml } from './site-shell';
import { SITE_STYLE } from './site-style';

export { JOIN_BUTTON_CLASS, JOIN_FORM_CLASS };
const ARIA_DISABLED = 'aria-disabled';
export const ANSWER_ATTRIBUTE = 'data-answer';
export const RETURN_ATTRIBUTE = 'data-return';
export const WIDGET_APPEARANCE = 'interaction-only';
export const WIDGET_THEME = 'auto';
export const WIDGET_CLASS = 'cf-turnstile';
export const TOKEN_CALLBACK = 'adminTokenReady';
const TITLE_ID = 'admin-title';
const EMAIL_ID = 'admin-email';
const CODE_ID = 'admin-code';

type Challenge = { widget: string; scriptTag: string };

type Card = { documentTitle: string; content: string };

type CardParameters = { copy: AdminCopy; codeCopy: EmailCodeCopy; challenge: Challenge; address: string | null };

type SignInPage = { hasForm: boolean; hasCode: boolean; cardOf: (parameters: CardParameters) => Card };

const NO_CHALLENGE: Challenge = { widget: '', scriptTag: '' };

export const PAGE_SCRIPT = `{
  const waitingForToken = new Set();
  const hasToken = (form) => {
    const token = form.querySelector('[name="${TURNSTILE_RESPONSE_FIELD}"]');
    return token !== null && token.value !== '';
  };
  window.${TOKEN_CALLBACK} = () => waitingForToken.forEach((form) => {
    if (!hasToken(form)) return;
    waitingForToken.delete(form);
    form.submit();
  });
  document.querySelectorAll('.${JOIN_FORM_CLASS}').forEach((form) => {
    const button = form.querySelector('.${JOIN_BUTTON_CLASS}');
    const label = button.textContent;
    const hasWidget = form.querySelector('.${WIDGET_CLASS}') !== null;
    form.addEventListener('submit', (event) => {
      if (button.getAttribute('${ARIA_DISABLED}') === 'true') return event.preventDefault();
      button.setAttribute('${ARIA_DISABLED}', 'true');
      if (event.submitter === button) button.textContent = button.dataset.submitting;
      if (!hasWidget || hasToken(form)) return;
      event.preventDefault();
      waitingForToken.add(form);
    });
    addEventListener('pageshow', (event) => {
      if (!event.persisted) return;
      waitingForToken.delete(form);
      button.removeAttribute('${ARIA_DISABLED}');
      button.textContent = label;
    });
  });
  const returnLink = document.querySelector('[${RETURN_ATTRIBUTE}]');
  if (returnLink !== null) location.replace(returnLink.href);
  addEventListener('load', () => requestAnimationFrame(() => {
    const answer = document.querySelector('[${ANSWER_ATTRIBUTE}]');
    if (answer !== null) answer.focus({ preventScroll: true });
  }));
}`;

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
const CODE_SCRIPTS = [PAGE_SCRIPT, EMAIL_CODE_SCRIPT];
const CODE_CONTENT_SECURITY_POLICY = await siteContentSecurityPolicy({
  style: SITE_STYLE,
  scripts: CODE_SCRIPTS,
  widgetOrigin: null,
  connectsToSelf: false,
  declaresManifest: false,
});
const CODE_CHALLENGE_CONTENT_SECURITY_POLICY = await siteContentSecurityPolicy({
  style: SITE_STYLE,
  scripts: CODE_SCRIPTS,
  widgetOrigin: TURNSTILE_ORIGIN,
  connectsToSelf: false,
  declaresManifest: false,
});
export function adminCardMainHtml(content: string): string {
  return `<main id="${CONTENT_ID}">
<section class="admin-card glass rise">
${glyphHtml({ glyph: SiteGlyph.Icon, className: 'final-icon' })}
${content}
</section>
</main>`;
}

export function answerTitleHtml(title: string): string {
  return `<h1 id="${TITLE_ID}" class="admin-title" ${ANSWER_ATTRIBUTE} tabindex="-1">${escapedHtml(title)}</h1>`;
}

function backLinkHtml(copy: AdminCopy): string {
  return `<a class="admin-link" href="${AdminPath.Panel}">${escapedHtml(copy.inbox.back)}</a>`;
}

// NB ADR 0046: the site key sits in a data attribute, so the page script stays one fixed source with one hash.
function challengeOf(siteKey: string): Challenge {
  return {
    widget: `<div class="${WIDGET_CLASS}" data-sitekey="${siteKey}" data-action="${TurnstileAction.AdminSignIn}" data-appearance="${WIDGET_APPEARANCE}" data-theme="${WIDGET_THEME}" data-callback="${TOKEN_CALLBACK}"></div>\n`,
    scriptTag: `${TURNSTILE_SCRIPT_TAG}\n`,
  };
}

export function noticeHtml(text: string | null): string {
  if (text === null) return '';
  return `<p class="join-notice" role="status" tabindex="-1" ${ANSWER_ATTRIBUTE}><span class="notice-dot" aria-hidden="true"></span>${escapedHtml(text)}</p>\n`;
}

function signInCardOf({ copy, notice, challenge }: Pick<CardParameters, 'copy' | 'challenge'> & { notice: string | null }): Card {
  return {
    documentTitle: copy.meta.signInTitle,
    content: `<h1 id="${TITLE_ID}" class="admin-title">${escapedHtml(copy.signIn.title)}</h1>
<p class="admin-body">${escapedHtml(copy.signIn.lead)}</p>
<form class="${JOIN_FORM_CLASS} admin-form" method="post" action="${AdminPath.SignInLinks}">
<div class="join-capsule">
<label class="visually-hidden" for="${EMAIL_ID}">${escapedHtml(copy.signIn.emailLabel)}</label>
<input id="${EMAIL_ID}" class="join-input" name="${AdminField.Email}" type="email" autocomplete="email" inputmode="email" placeholder="${escapedHtml(copy.signIn.emailPlaceholder)}" required autofocus>
<button class="${JOIN_BUTTON_CLASS}" type="submit" data-submitting="${escapedHtml(copy.signIn.submitting)}">${escapedHtml(copy.signIn.submit)}</button>
</div>
${challenge.widget}${noticeHtml(notice)}</form>
${challenge.scriptTag}`,
  };
}

function codeCardOf({ copy, codeCopy, challenge, address, state }: CardParameters & { state: CodeState | null }): Card {
  const addressFields = address === null ? [] : [{ name: AdminField.Email, value: address }];
  const hasResend = address !== null && challenge.widget !== '';
  const resend = hasResend
    ? `${resendFormHtml({ copy: codeCopy, action: AdminPath.SignInLinks, fields: addressFields, widget: challenge.widget })}\n`
    : '';
  return {
    documentTitle: copy.meta.inboxTitle,
    content: `<h1 id="${TITLE_ID}" class="admin-title">${escapedHtml(copy.inbox.title)}</h1>
<p class="admin-body">${escapedHtml(copy.inbox.body)}</p>
${codeFormHtml({ copy: codeCopy, action: AdminPath.CodeSessions, fields: addressFields, inputId: CODE_ID, state })}
${resend}${challenge.scriptTag}${backLinkHtml(copy)}`,
  };
}

function closedCardOf({ copy }: CardParameters): Card {
  return { documentTitle: copy.meta.closedTitle, content: answerTitleHtml(copy.refusal.closed) };
}

function forbiddenCardOf({ copy }: CardParameters): Card {
  return {
    documentTitle: copy.meta.refusedTitle,
    content: `${answerTitleHtml(copy.refusal.crossOriginTitle)}
<p class="admin-body">${escapedHtml(copy.refusal.crossOriginBody)}</p>
${backLinkHtml(copy)}`,
  };
}

function cardDocumentHtml({
  card,
  copy,
  preferences,
  scripts,
}: {
  card: Card;
  copy: AdminCopy;
  preferences: PagePreferences;
  scripts: string[];
}): string {
  return siteDocumentHtml({
    hasControls: true,
    kind: SitePageKind.Private,
    title: card.documentTitle,
    description: copy.meta.description,
    main: adminCardMainHtml(card.content),
    scripts,
    preferences,
  });
}

const SIGN_IN_PAGES: Record<AdminNotice, SignInPage> = {
  [AdminNotice.None]: {
    hasForm: true,
    hasCode: false,
    cardOf: ({ copy, challenge }) => signInCardOf({ copy, notice: null, challenge }),
  },
  [AdminNotice.TryAgain]: {
    hasForm: true,
    hasCode: false,
    cardOf: ({ copy, challenge }) => signInCardOf({ copy, notice: copy.refusal.tooMany, challenge }),
  },
  [AdminNotice.CheckInbox]: { hasForm: true, hasCode: true, cardOf: (parameters) => codeCardOf({ ...parameters, state: null }) },
  [AdminNotice.WrongCode]: { hasForm: true, hasCode: true, cardOf: (parameters) => codeCardOf({ ...parameters, state: CodeState.Wrong }) },
  [AdminNotice.CodeLocked]: {
    hasForm: true,
    hasCode: true,
    cardOf: (parameters) => codeCardOf({ ...parameters, state: CodeState.Locked }),
  },
  [AdminNotice.Closed]: { hasForm: false, hasCode: false, cardOf: closedCardOf },
  [AdminNotice.Forbidden]: { hasForm: false, hasCode: false, cardOf: forbiddenCardOf },
};

type PagePolicy = { scripts: string[]; policy: string };

function pagePolicyOf({ page, hasWidget }: { page: SignInPage; hasWidget: boolean }): PagePolicy {
  if (page.hasCode && hasWidget) return { scripts: CODE_SCRIPTS, policy: CODE_CHALLENGE_CONTENT_SECURITY_POLICY };
  if (page.hasCode) return { scripts: CODE_SCRIPTS, policy: CODE_CONTENT_SECURITY_POLICY };
  if (hasWidget) return { scripts: [PAGE_SCRIPT], policy: CHALLENGE_CONTENT_SECURITY_POLICY };
  return { scripts: [PAGE_SCRIPT], policy: CONTENT_SECURITY_POLICY };
}

export async function serveAdminSignInPage({
  request,
  notice,
  siteKey,
  address,
}: {
  request: Request;
  notice: AdminNotice;
  siteKey: string | null;
  address?: string;
}): Promise<Response> {
  const page = SIGN_IN_PAGES[notice];
  const preferences = adminPreferencesOf({ request });
  const copy = ADMIN_COPY_BY_LANGUAGE[preferences.language];
  const codeCopy = EMAIL_CODE_COPY_BY_LANGUAGE[preferences.language];
  const usableSiteKey = page.hasForm ? usableSiteKeyOf(siteKey) : null;
  const challenge = usableSiteKey === null ? NO_CHALLENGE : challengeOf(usableSiteKey);
  const { scripts, policy } = pagePolicyOf({ page, hasWidget: usableSiteKey !== null });
  const card = page.cardOf({ copy, codeCopy, challenge, address: address === undefined ? null : address });
  return adminPageResponse({ html: cardDocumentHtml({ card, copy, preferences, scripts }), contentSecurityPolicy: policy });
}
