import { escapedHtml } from '../escaped-html';
import type { PagePreferences } from '../page-preferences';
import { TurnstileAction } from '../turnstile';
import { TURNSTILE_ORIGIN, TURNSTILE_RESPONSE_FIELD, TURNSTILE_SCRIPT_TAG, usableSiteKeyOf } from '../turnstile-page';
import { ADMIN_COPY_BY_LANGUAGE, type AdminCopy } from './admin-copy';
import { AdminNotice } from './admin-notice';
import { AdminField, AdminPath } from './admin-paths';
import { adminPreferencesOf } from './admin-preferences';
import { SiteGlyph, glyphHtml } from './site-glyphs';
import { adminPageResponse, siteContentSecurityPolicy } from './site-headers';
import { CONTENT_ID, SitePageKind, siteDocumentHtml } from './site-shell';
import { SITE_STYLE } from './site-style';

export const JOIN_FORM_CLASS = 'join-form';
export const JOIN_BUTTON_CLASS = 'join-button';
const ARIA_DISABLED = 'aria-disabled';
export const ANSWER_ATTRIBUTE = 'data-answer';
export const RETURN_ATTRIBUTE = 'data-return';
export const WIDGET_APPEARANCE = 'interaction-only';
export const WIDGET_THEME = 'auto';
export const WIDGET_CLASS = 'cf-turnstile';
export const TOKEN_CALLBACK = 'adminTokenReady';
const TITLE_ID = 'admin-title';
const EMAIL_ID = 'admin-email';

type Challenge = { widget: string; scriptTag: string };

type Card = { documentTitle: string; content: string };

type CardParameters = { copy: AdminCopy; challenge: Challenge };

type SignInPage = { hasForm: boolean; cardOf: (parameters: CardParameters) => Card };

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

function signInCardOf({ copy, notice, challenge }: CardParameters & { notice: string | null }): Card {
  return {
    documentTitle: copy.meta.signInTitle,
    content: `<h1 id="${TITLE_ID}" class="admin-title">${escapedHtml(copy.signIn.title)}</h1>
<p class="admin-body">${escapedHtml(copy.signIn.lead)}</p>
<form class="${JOIN_FORM_CLASS} admin-form" method="post" action="${AdminPath.SignInLinks}">
<div class="join-capsule">
<label class="visually-hidden" for="${EMAIL_ID}">${escapedHtml(copy.signIn.emailLabel)}</label>
<input id="${EMAIL_ID}" class="join-input" name="${AdminField.Email}" type="email" autocomplete="email" inputmode="email" placeholder="${escapedHtml(copy.signIn.emailPlaceholder)}" required>
<button class="${JOIN_BUTTON_CLASS}" type="submit" data-submitting="${escapedHtml(copy.signIn.submitting)}">${escapedHtml(copy.signIn.submit)}</button>
</div>
${challenge.widget}${noticeHtml(notice)}</form>
${challenge.scriptTag}`,
  };
}

function inboxCardOf({ copy }: CardParameters): Card {
  return {
    documentTitle: copy.meta.inboxTitle,
    content: `${answerTitleHtml(copy.inbox.title)}
<p class="admin-body">${escapedHtml(copy.inbox.body)}</p>
${backLinkHtml(copy)}`,
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

function cardDocumentHtml({ card, copy, preferences }: { card: Card; copy: AdminCopy; preferences: PagePreferences }): string {
  return siteDocumentHtml({
    hasControls: true,
    kind: SitePageKind.Private,
    title: card.documentTitle,
    description: copy.meta.description,
    main: adminCardMainHtml(card.content),
    scripts: [PAGE_SCRIPT],
    preferences,
  });
}

const SIGN_IN_PAGES: Record<AdminNotice, SignInPage> = {
  [AdminNotice.None]: { hasForm: true, cardOf: ({ copy, challenge }) => signInCardOf({ copy, notice: null, challenge }) },
  [AdminNotice.TryAgain]: {
    hasForm: true,
    cardOf: ({ copy, challenge }) => signInCardOf({ copy, notice: copy.refusal.tooMany, challenge }),
  },
  [AdminNotice.CheckInbox]: { hasForm: false, cardOf: inboxCardOf },
  [AdminNotice.Closed]: { hasForm: false, cardOf: closedCardOf },
  [AdminNotice.Forbidden]: { hasForm: false, cardOf: forbiddenCardOf },
};

export async function serveAdminSignInPage({
  request,
  notice,
  siteKey,
}: {
  request: Request;
  notice: AdminNotice;
  siteKey: string | null;
  address?: string;
}): Promise<Response> {
  const page = SIGN_IN_PAGES[notice];
  const preferences = adminPreferencesOf({ request });
  const copy = ADMIN_COPY_BY_LANGUAGE[preferences.language];
  const usableSiteKey = page.hasForm ? usableSiteKeyOf(siteKey) : null;
  if (usableSiteKey === null) {
    const card = page.cardOf({ copy, challenge: NO_CHALLENGE });
    return adminPageResponse({ html: cardDocumentHtml({ card, copy, preferences }), contentSecurityPolicy: CONTENT_SECURITY_POLICY });
  }
  const card = page.cardOf({ copy, challenge: challengeOf(usableSiteKey) });
  return adminPageResponse({
    html: cardDocumentHtml({ card, copy, preferences }),
    contentSecurityPolicy: CHALLENGE_CONTENT_SECURITY_POLICY,
  });
}
