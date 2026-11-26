import { escapedHtml } from '../escaped-html';
import { TurnstileAction } from '../turnstile';
import { TURNSTILE_ORIGIN, TURNSTILE_RESPONSE_FIELD, TURNSTILE_SCRIPT_TAG, usableSiteKeyOf } from '../turnstile-page';
import { ADMIN_COPY } from './admin-copy';
import { AdminField, AdminPath } from './admin-paths';
import { AdminNotice, ConfirmationState, type WaitlistRow, type WaitlistSummary } from './admin-waitlist';
import { SiteGlyph, glyphHtml } from './site-glyphs';
import { adminPageResponse, siteContentSecurityPolicy } from './site-headers';
import { CONTENT_ID, SitePageKind, siteDocumentHtml } from './site-shell';
import { SITE_STYLE } from './site-style';

const JOIN_FORM_CLASS = 'join-form';
const JOIN_BUTTON_CLASS = 'join-button';
const ARIA_DISABLED = 'aria-disabled';
const ANSWER_ATTRIBUTE = 'data-answer';
const WIDGET_APPEARANCE = 'interaction-only';
const WIDGET_THEME = 'auto';
const WIDGET_CLASS = 'cf-turnstile';
const TOKEN_CALLBACK = 'adminTokenReady';
const TITLE_ID = 'admin-title';
const EMAIL_ID = 'admin-email';
const COUNT_LOCALE = 'en-US';
const ISO_DATE_END = 10;
const ISO_TIME_START = 11;
const ISO_MINUTE_END = 16;
const COUNT_FORMAT = new Intl.NumberFormat(COUNT_LOCALE);

type Challenge = { widget: string; scriptTag: string };

type Card = { documentTitle: string; content: string };

type SignInPage = { hasForm: boolean; available: (siteKey: string) => string; unavailable: string };

type Badge = { className: string; label: string };

const NO_CHALLENGE: Challenge = { widget: '', scriptTag: '' };

const BADGE_OF_CONFIRMATION: Record<ConfirmationState, Badge> = {
  [ConfirmationState.Sent]: { className: 'badge badge-sent', label: ADMIN_COPY.table.sent },
  [ConfirmationState.Failed]: { className: 'badge badge-failed', label: ADMIN_COPY.table.failed },
};

const PAGE_SCRIPT = `{
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
const PANEL_CONTENT_SECURITY_POLICY = await siteContentSecurityPolicy({
  style: SITE_STYLE,
  scripts: [],
  widgetOrigin: null,
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

function answerTitleHtml(title: string): string {
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

function noticeHtml(text: string | null): string {
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

function joinedLabelOf(joinedAt: number): string {
  const iso = new Date(joinedAt).toISOString();
  return `${iso.slice(0, ISO_DATE_END)} ${iso.slice(ISO_TIME_START, ISO_MINUTE_END)} ${ADMIN_COPY.table.timeZone}`;
}

function statTileHtml({ label, count }: { label: string; count: number }): string {
  return `<div class="stat-tile glass"><dt>${escapedHtml(label)}</dt><dd>${COUNT_FORMAT.format(count)}</dd></div>`;
}

function badgeHtml(confirmation: ConfirmationState): string {
  const { className, label } = BADGE_OF_CONFIRMATION[confirmation];
  return `<span class="${className}"><span class="badge-dot" aria-hidden="true"></span>${escapedHtml(label)}</span>`;
}

function rowHtml({ address, joinedAt, confirmation }: WaitlistRow): string {
  return `<tr role="row"><th scope="row" role="rowheader">${escapedHtml(address)}</th><td role="cell"><time datetime="${new Date(joinedAt).toISOString()}">${joinedLabelOf(joinedAt)}</time></td><td role="cell">${badgeHtml(confirmation)}</td></tr>`;
}

function columnHeaderHtml(heading: string): string {
  return `<th scope="col" role="columnheader">${escapedHtml(heading)}</th>`;
}

function capNoteHtml(summary: WaitlistSummary): string {
  if (summary.total <= summary.rows.length) return '';
  const note = ADMIN_COPY.table.capNote({ shown: COUNT_FORMAT.format(summary.rows.length), total: COUNT_FORMAT.format(summary.total) });
  return `\n<p class="table-note">${escapedHtml(note)}</p>`;
}

function tableCardHtml(summary: WaitlistSummary): string {
  const { table } = ADMIN_COPY;
  return `<div class="table-card glass">
<table class="admin-table" role="table">
<caption class="visually-hidden">${escapedHtml(table.caption)}</caption>
<thead role="rowgroup"><tr role="row">${[table.address, table.joined, table.confirmation].map(columnHeaderHtml).join('')}</tr></thead>
<tbody role="rowgroup">
${summary.rows.map(rowHtml).join('\n')}
</tbody>
</table>${capNoteHtml(summary)}
</div>`;
}

function emptyCardHtml(): string {
  return `<div class="empty-card glass">
<h2 class="empty-title">${escapedHtml(ADMIN_COPY.empty.title)}</h2>
<p class="empty-body">${escapedHtml(ADMIN_COPY.empty.body)}</p>
</div>`;
}

function panelHtml(summary: WaitlistSummary): string {
  const { panel, stats } = ADMIN_COPY;
  const listing = summary.rows.length === 0 ? emptyCardHtml() : tableCardHtml(summary);
  return siteDocumentHtml({
    kind: SitePageKind.Private,
    title: ADMIN_COPY.meta.panelTitle,
    description: ADMIN_COPY.meta.description,
    main: `<main id="${CONTENT_ID}">
<div class="admin-panel rise">
<div class="panel-head">
<h1 class="panel-title">${escapedHtml(panel.title)}</h1>
<nav class="panel-actions" aria-label="${escapedHtml(ADMIN_COPY.shell.navLabel)}">
<a class="admin-action" href="${AdminPath.Metrics}">${escapedHtml(ADMIN_COPY.metrics.link)}</a>
<a class="admin-action" href="${AdminPath.Usage}">${escapedHtml(ADMIN_COPY.usage.link)}</a>
<a class="admin-action" href="${AdminPath.Export}" download>${escapedHtml(panel.download)}</a>
<form method="post" action="${AdminPath.SignOut}"><button class="nav-link nav-button" type="submit">${escapedHtml(panel.signOut)}</button></form>
</nav>
</div>
<h2 class="visually-hidden">${escapedHtml(panel.summaryHeading)}</h2>
<dl class="stat-list">
${statTileHtml({ label: stats.total, count: summary.total })}
${statTileHtml({ label: stats.recent, count: summary.joinedLastDay })}
${statTileHtml({ label: stats.failed, count: summary.failedConfirmations })}
</dl>
<h2 class="visually-hidden">${escapedHtml(panel.tableHeading)}</h2>
${listing}
</div>
</main>`,
    scripts: [],
  });
}

export async function serveAdminPanel({ summary }: { summary: WaitlistSummary }): Promise<Response> {
  return adminPageResponse({ html: panelHtml(summary), contentSecurityPolicy: PANEL_CONTENT_SECURITY_POLICY });
}
