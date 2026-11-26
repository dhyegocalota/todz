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
import { adminPageResponse, siteContentSecurityPolicy } from './site-headers';
import { LANDING_PATH, SitePageKind, siteDocumentHtml } from './site-shell';
import { SITE_STYLE } from './site-style';
import { DOCS_SELF_HOST_URL } from './self-host-redirect';
import { CLOUD_QUEUE_PATH, CLOUD_QUEUE_TOKEN_FIELD } from './site-urls';

export enum CloudQueueNotice {
  None = 'none',
  Queued = 'queued',
  TryAgain = 'try-again',
  Closed = 'closed',
  Forbidden = 'forbidden',
  Invalid = 'invalid',
}

export type CloudQueueForm = { token: string; maskedAddress: string };

export const STATUS_OF_CLOUD_QUEUE_NOTICE: Record<CloudQueueNotice, HttpStatus> = {
  [CloudQueueNotice.None]: HttpStatus.Ok,
  [CloudQueueNotice.Queued]: HttpStatus.Ok,
  [CloudQueueNotice.TryAgain]: HttpStatus.TooManyRequests,
  [CloudQueueNotice.Closed]: HttpStatus.Unavailable,
  [CloudQueueNotice.Forbidden]: HttpStatus.Forbidden,
  [CloudQueueNotice.Invalid]: HttpStatus.BadRequest,
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

export function maskedAddressOf(address: string): string {
  const [name, domain] = address.split('@');
  return `${name?.slice(0, 1)}…@${domain}`;
}

function selfHostHtml(): string {
  const { selfHost, selfHostLink } = CLOUD_COPY.queuePage;
  return `<p class="admin-body">${escapedHtml(selfHost)} <a class="admin-link" href="${DOCS_SELF_HOST_URL}">${escapedHtml(selfHostLink)}</a></p>`;
}

function formHtml({ notice, siteKey, form }: { notice: string | null; siteKey: string; form: CloudQueueForm }): string {
  const copy = CLOUD_COPY.queuePage;
  const widget = `<div class="${WIDGET_CLASS}" data-sitekey="${siteKey}" data-action="${TurnstileAction.CloudQueue}" data-appearance="${WIDGET_APPEARANCE}" data-theme="${WIDGET_THEME}" data-callback="${TOKEN_CALLBACK}"></div>\n`;
  return `<h1 class="admin-title">${escapedHtml(copy.title)}</h1>
<p class="admin-body">${escapedHtml(copy.lead)}</p>
<form class="${JOIN_FORM_CLASS} admin-form" method="post" action="${CLOUD_QUEUE_PATH}">
<input type="hidden" name="${CLOUD_QUEUE_TOKEN_FIELD}" value="${escapedHtml(form.token)}">
<div class="join-capsule">
<p class="admin-body">${escapedHtml(copy.joinAs)} ${escapedHtml(form.maskedAddress)}</p>
<button class="${JOIN_BUTTON_CLASS}" type="submit" data-submitting="${escapedHtml(copy.submitting)}">${escapedHtml(copy.submit)}</button>
</div>
${widget}${noticeHtml(notice)}</form>
${TURNSTILE_SCRIPT_TAG}
${selfHostHtml()}`;
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

type Answer = { title: string; body: string | null };

const INVALID_ANSWER: Answer = { title: CLOUD_COPY.queuePage.invalidTitle, body: CLOUD_COPY.queuePage.invalidBody };

const ANSWER_OF_NOTICE: Record<CloudQueueNotice, Answer | null> = {
  [CloudQueueNotice.None]: null,
  [CloudQueueNotice.TryAgain]: null,
  [CloudQueueNotice.Queued]: { title: CLOUD_COPY.queuePage.queuedTitle, body: CLOUD_COPY.queuePage.queuedBody },
  [CloudQueueNotice.Closed]: { title: CLOUD_COPY.queuePage.closed, body: null },
  [CloudQueueNotice.Forbidden]: { title: CLOUD_COPY.queuePage.forbidden, body: null },
  [CloudQueueNotice.Invalid]: INVALID_ANSWER,
};

export function cloudQueuePageResponse({
  notice,
  siteKey,
  form,
}: {
  notice: CloudQueueNotice;
  siteKey: string | null;
  form: CloudQueueForm | null;
}): Response {
  const usableSiteKey = usableSiteKeyOf(siteKey);
  const page = pageOf({ notice, usableSiteKey, form });
  const response = adminPageResponse({
    html: documentHtml(page.content),
    contentSecurityPolicy: page.hasChallenge ? CHALLENGE_CONTENT_SECURITY_POLICY : CONTENT_SECURITY_POLICY,
  });
  return new Response(response.body, { status: page.status, headers: response.headers });
}

function pageOf({ notice, usableSiteKey, form }: { notice: CloudQueueNotice; usableSiteKey: string | null; form: CloudQueueForm | null }): {
  content: string;
  hasChallenge: boolean;
  status: HttpStatus;
} {
  const answer = ANSWER_OF_NOTICE[notice];
  if (answer !== null) return { content: answerHtml(answer), hasChallenge: false, status: STATUS_OF_CLOUD_QUEUE_NOTICE[notice] };
  if (usableSiteKey === null || form === null) {
    return { content: answerHtml(INVALID_ANSWER), hasChallenge: false, status: STATUS_OF_CLOUD_QUEUE_NOTICE[CloudQueueNotice.Invalid] };
  }
  const formNotice = notice === CloudQueueNotice.TryAgain ? CLOUD_COPY.queuePage.tryAgain : null;
  return {
    content: formHtml({ notice: formNotice, siteKey: usableSiteKey, form }),
    hasChallenge: true,
    status: STATUS_OF_CLOUD_QUEUE_NOTICE[notice],
  };
}
