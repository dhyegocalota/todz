import { CLOUD_COPY } from '../cloud-copy';
import { escapedHtml } from '../escaped-html';
import { HttpStatus } from '../http-status';
import { TurnstileAction } from '../turnstile';
import { TURNSTILE_ORIGIN, TURNSTILE_SCRIPT_TAG, usableSiteKeyOf } from '../turnstile-page';
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
} from './admin-page';
import { AdminField } from './admin-paths';
import { adminPageResponse, siteContentSecurityPolicy } from './site-headers';
import { LANDING_PATH, SitePageKind, siteDocumentHtml } from './site-shell';
import { SITE_STYLE } from './site-style';
import { DOCS_SELF_HOST_URL } from './self-host-redirect';
import { CLOUD_QUEUE_PATH } from './site-urls';

const EMAIL_ID = 'queue-email';

export enum CloudQueueNotice {
  None = 'none',
  Queued = 'queued',
  TryAgain = 'try-again',
  Closed = 'closed',
  Forbidden = 'forbidden',
}

export const STATUS_OF_CLOUD_QUEUE_NOTICE: Record<CloudQueueNotice, HttpStatus> = {
  [CloudQueueNotice.None]: HttpStatus.Ok,
  [CloudQueueNotice.Queued]: HttpStatus.Ok,
  [CloudQueueNotice.TryAgain]: HttpStatus.TooManyRequests,
  [CloudQueueNotice.Closed]: HttpStatus.Unavailable,
  [CloudQueueNotice.Forbidden]: HttpStatus.Forbidden,
};

type QueuePage = { hasForm: boolean; available: (siteKey: string) => string; unavailable: string };

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

function selfHostHtml(): string {
  const { selfHost, selfHostLink } = CLOUD_COPY.queuePage;
  return `<p class="admin-body">${escapedHtml(selfHost)} <a class="admin-link" href="${DOCS_SELF_HOST_URL}">${escapedHtml(selfHostLink)}</a></p>`;
}

function formHtml({ notice, siteKey }: { notice: string | null; siteKey: string | null }): string {
  const copy = CLOUD_COPY.queuePage;
  const widget =
    siteKey === null
      ? ''
      : `<div class="${WIDGET_CLASS}" data-sitekey="${siteKey}" data-action="${TurnstileAction.CloudQueue}" data-appearance="${WIDGET_APPEARANCE}" data-theme="${WIDGET_THEME}" data-callback="${TOKEN_CALLBACK}"></div>\n`;
  const scriptTag = siteKey === null ? '' : `${TURNSTILE_SCRIPT_TAG}\n`;
  return `<h1 class="admin-title">${escapedHtml(copy.title)}</h1>
<p class="admin-body">${escapedHtml(copy.lead)}</p>
<form class="${JOIN_FORM_CLASS} admin-form" method="post" action="${CLOUD_QUEUE_PATH}">
<div class="join-capsule">
<label class="visually-hidden" for="${EMAIL_ID}">${escapedHtml(copy.emailLabel)}</label>
<input id="${EMAIL_ID}" class="join-input" name="${AdminField.Email}" type="email" autocomplete="email" inputmode="email" placeholder="${escapedHtml(copy.emailPlaceholder)}" required>
<button class="${JOIN_BUTTON_CLASS}" type="submit" data-submitting="${escapedHtml(copy.submitting)}">${escapedHtml(copy.submit)}</button>
</div>
${widget}${noticeHtml(notice)}</form>
${scriptTag}${selfHostHtml()}`;
}

function answerHtml({ title, body }: { title: string; body: string | null }): string {
  const bodyHtml = body === null ? '' : `<p class="admin-body">${escapedHtml(body)}</p>\n`;
  return `${answerTitleHtml(title)}
${bodyHtml}${selfHostHtml()}
<a class="admin-link" href="${LANDING_PATH}">todz</a>`;
}

function documentHtml(content: string): string {
  return siteDocumentHtml({
    kind: SitePageKind.Private,
    title: CLOUD_COPY.queuePage.title,
    description: CLOUD_COPY.queuePage.lead,
    main: adminCardMainHtml(content),
    scripts: [PAGE_SCRIPT],
  });
}

function queuePageOf({ hasForm, contentOf }: { hasForm: boolean; contentOf: (siteKey: string | null) => string }): QueuePage {
  return {
    hasForm,
    available: (siteKey) => documentHtml(contentOf(siteKey)),
    unavailable: documentHtml(contentOf(null)),
  };
}

const QUEUE_PAGES: Record<CloudQueueNotice, QueuePage> = {
  [CloudQueueNotice.None]: queuePageOf({ hasForm: true, contentOf: (siteKey) => formHtml({ notice: null, siteKey }) }),
  [CloudQueueNotice.TryAgain]: queuePageOf({
    hasForm: true,
    contentOf: (siteKey) => formHtml({ notice: CLOUD_COPY.queuePage.tryAgain, siteKey }),
  }),
  [CloudQueueNotice.Queued]: queuePageOf({
    hasForm: false,
    contentOf: () => answerHtml({ title: CLOUD_COPY.queuePage.queuedTitle, body: CLOUD_COPY.queuePage.queuedBody }),
  }),
  [CloudQueueNotice.Closed]: queuePageOf({
    hasForm: false,
    contentOf: () => answerHtml({ title: CLOUD_COPY.queuePage.closed, body: null }),
  }),
  [CloudQueueNotice.Forbidden]: queuePageOf({
    hasForm: false,
    contentOf: () => answerHtml({ title: CLOUD_COPY.queuePage.forbidden, body: null }),
  }),
};

export function cloudQueuePageResponse({ notice, siteKey }: { notice: CloudQueueNotice; siteKey: string | null }): Response {
  const page = QUEUE_PAGES[notice];
  const usableSiteKey = page.hasForm ? usableSiteKeyOf(siteKey) : null;
  const status = STATUS_OF_CLOUD_QUEUE_NOTICE[notice];
  const isChallenged = usableSiteKey !== null;
  const html = isChallenged ? page.available(usableSiteKey) : page.unavailable;
  const contentSecurityPolicy = isChallenged ? CHALLENGE_CONTENT_SECURITY_POLICY : CONTENT_SECURITY_POLICY;
  const response = adminPageResponse({ html, contentSecurityPolicy });
  return new Response(response.body, { status, headers: response.headers });
}
