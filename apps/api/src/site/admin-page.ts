import { escapedHtml } from '../escaped-html';
import { TurnstileAction } from '../turnstile';
import { TURNSTILE_ORIGIN, TURNSTILE_RESPONSE_FIELD, TURNSTILE_SCRIPT_TAG, usableSiteKeyOf } from '../turnstile-page';
import { ADMIN_COPY } from './admin-copy';
import { AdminNotice } from './admin-notice';
import { AdminField, AdminPath } from './admin-paths';
import { SiteGlyph, glyphHtml } from './site-glyphs';
import { adminPageResponse, siteContentSecurityPolicy } from './site-headers';
import { CONTENT_ID, SitePageKind, siteDocumentHtml } from './site-shell';
import { SITE_STYLE } from './site-style';

export const JOIN_FORM_CLASS = 'join-form';
export const JOIN_BUTTON_CLASS = 'join-button';
const ARIA_DISABLED = 'aria-disabled';
export const ANSWER_ATTRIBUTE = 'data-answer';
export const WIDGET_APPEARANCE = 'interaction-only';
export const WIDGET_THEME = 'auto';
export const WIDGET_CLASS = 'cf-turnstile';
export const TOKEN_CALLBACK = 'adminTokenReady';
const TITLE_ID = 'admin-title';
const EMAIL_ID = 'admin-email';

type Challenge = { widget: string; scriptTag: string };

type Card = { documentTitle: string; content: string };

type SignInPage = { hasForm: boolean; available: (siteKey: string) => string; unavailable: string };

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
      button.textContent = button.dataset.submitting;
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

function backLinkHtml(): string {
  return `<a class="admin-link" href="${AdminPath.Panel}">${escapedHtml(ADMIN_COPY.inbox.back)}</a>`;
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

function signInCardOf({ notice, challenge }: { notice: string | null; challenge: Challenge }): Card {
  return {
    documentTitle: ADMIN_COPY.meta.signInTitle,
    content: `<h1 id="${TITLE_ID}" class="admin-title">${escapedHtml(ADMIN_COPY.signIn.title)}</h1>
<p class="admin-body">${escapedHtml(ADMIN_COPY.signIn.lead)}</p>
<form class="${JOIN_FORM_CLASS} admin-form" method="post" action="${AdminPath.SignInLinks}">
<div class="join-capsule">
<label class="visually-hidden" for="${EMAIL_ID}">${escapedHtml(ADMIN_COPY.signIn.emailLabel)}</label>
<input id="${EMAIL_ID}" class="join-input" name="${AdminField.Email}" type="email" autocomplete="email" inputmode="email" placeholder="${escapedHtml(ADMIN_COPY.signIn.emailPlaceholder)}" required>
<button class="${JOIN_BUTTON_CLASS}" type="submit" data-submitting="${escapedHtml(ADMIN_COPY.signIn.submitting)}">${escapedHtml(ADMIN_COPY.signIn.submit)}</button>
</div>
${challenge.widget}${noticeHtml(notice)}</form>
${challenge.scriptTag}`,
  };
}

function inboxCard(): Card {
  return {
    documentTitle: ADMIN_COPY.meta.inboxTitle,
    content: `${answerTitleHtml(ADMIN_COPY.inbox.title)}
<p class="admin-body">${escapedHtml(ADMIN_COPY.inbox.body)}</p>
${backLinkHtml()}`,
  };
}

function closedCard(): Card {
  return { documentTitle: ADMIN_COPY.meta.closedTitle, content: answerTitleHtml(ADMIN_COPY.refusal.closed) };
}

function forbiddenCard(): Card {
  return {
    documentTitle: ADMIN_COPY.meta.refusedTitle,
    content: `${answerTitleHtml(ADMIN_COPY.refusal.crossOriginTitle)}
<p class="admin-body">${escapedHtml(ADMIN_COPY.refusal.crossOriginBody)}</p>
${backLinkHtml()}`,
  };
}

function cardDocumentHtml({ documentTitle, content }: Card): string {
  return siteDocumentHtml({
    kind: SitePageKind.Private,
    title: documentTitle,
    description: ADMIN_COPY.meta.description,
    main: adminCardMainHtml(content),
    scripts: [PAGE_SCRIPT],
  });
}

function signInPageOf({ hasForm, cardOf }: { hasForm: boolean; cardOf: (challenge: Challenge) => Card }): SignInPage {
  return {
    hasForm,
    available: (siteKey) => cardDocumentHtml(cardOf(challengeOf(siteKey))),
    unavailable: cardDocumentHtml(cardOf(NO_CHALLENGE)),
  };
}

const SIGN_IN_PAGES: Record<AdminNotice, SignInPage> = {
  [AdminNotice.None]: signInPageOf({ hasForm: true, cardOf: (challenge) => signInCardOf({ notice: null, challenge }) }),
  [AdminNotice.TryAgain]: signInPageOf({
    hasForm: true,
    cardOf: (challenge) => signInCardOf({ notice: ADMIN_COPY.refusal.tooMany, challenge }),
  }),
  [AdminNotice.CheckInbox]: signInPageOf({ hasForm: false, cardOf: inboxCard }),
  [AdminNotice.Closed]: signInPageOf({ hasForm: false, cardOf: closedCard }),
  [AdminNotice.Forbidden]: signInPageOf({ hasForm: false, cardOf: forbiddenCard }),
};

export async function serveAdminSignInPage({ notice, siteKey }: { notice: AdminNotice; siteKey: string | null }): Promise<Response> {
  const page = SIGN_IN_PAGES[notice];
  const usableSiteKey = page.hasForm ? usableSiteKeyOf(siteKey) : null;
  if (usableSiteKey === null) return adminPageResponse({ html: page.unavailable, contentSecurityPolicy: CONTENT_SECURITY_POLICY });
  return adminPageResponse({ html: page.available(usableSiteKey), contentSecurityPolicy: CHALLENGE_CONTENT_SECURITY_POLICY });
}
