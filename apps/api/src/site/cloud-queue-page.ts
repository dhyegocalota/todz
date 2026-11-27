import { Language } from '@todz/types';
import { CLOUD_PAGE_COPY_BY_LANGUAGE } from '../cloud-page-copy';
import { escapedHtml } from '../escaped-html';
import { HttpStatus } from '../http-status';
import type { PagePreferences } from '../page-preferences';
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
import { publicPathOf } from './language-paths';
import { adminPageResponse, siteContentSecurityPolicy } from './site-headers';
import { SitePageKind, siteDocumentHtml } from './site-shell';
import { SITE_STYLE } from './site-style';
import { CLOUD_QUEUE_PATH, CLOUD_QUEUE_TOKEN_FIELD, DOCS_SELF_HOST_PAGE, LANDING_PATH, docsUrlOf } from './site-urls';

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

function selfHostHtml(language: Language): string {
  const { selfHost, selfHostLink } = CLOUD_PAGE_COPY_BY_LANGUAGE[language].queuePage;
  return `<p class="admin-body">${escapedHtml(selfHost)} <a class="admin-link" href="${docsUrlOf({ language, page: DOCS_SELF_HOST_PAGE })}">${escapedHtml(selfHostLink)}</a></p>`;
}

function formHtml({
  notice,
  siteKey,
  form,
  language,
}: {
  notice: string | null;
  siteKey: string;
  form: CloudQueueForm;
  language: Language;
}): string {
  const copy = CLOUD_PAGE_COPY_BY_LANGUAGE[language].queuePage;
  const widget = `<div class="${WIDGET_CLASS}" data-sitekey="${siteKey}" data-action="${TurnstileAction.CloudQueue}" data-appearance="${WIDGET_APPEARANCE}" data-theme="${WIDGET_THEME}" data-callback="${TOKEN_CALLBACK}"></div>\n`;
  return `<h1 class="admin-title">${escapedHtml(copy.title)}</h1>
<p class="admin-body">${escapedHtml(copy.lead)}</p>
<form class="${JOIN_FORM_CLASS} admin-form" method="post" action="${publicPathOf({ language, path: CLOUD_QUEUE_PATH })}">
<input type="hidden" name="${CLOUD_QUEUE_TOKEN_FIELD}" value="${escapedHtml(form.token)}">
<div class="join-capsule">
<p class="admin-body">${escapedHtml(copy.joinAs)} ${escapedHtml(form.maskedAddress)}</p>
<button class="${JOIN_BUTTON_CLASS}" type="submit" data-submitting="${escapedHtml(copy.submitting)}">${escapedHtml(copy.submit)}</button>
</div>
${widget}${noticeHtml(notice)}</form>
${TURNSTILE_SCRIPT_TAG}
${selfHostHtml(language)}`;
}

function answerHtml({ title, body, language }: { title: string; body: string | null; language: Language }): string {
  const bodyHtml = body === null ? '' : `<p class="admin-body">${escapedHtml(body)}</p>\n`;
  return `${answerTitleHtml(title)}
${bodyHtml}${selfHostHtml(language)}
<a class="admin-link" href="${publicPathOf({ language, path: LANDING_PATH })}">todz</a>`;
}

function documentHtml({ content, preferences }: { content: string; preferences: PagePreferences }): string {
  const { queuePage } = CLOUD_PAGE_COPY_BY_LANGUAGE[preferences.language];
  return siteDocumentHtml({
    kind: SitePageKind.Private,
    title: queuePage.title,
    description: queuePage.lead,
    main: adminCardMainHtml(content),
    scripts: [PAGE_SCRIPT],
    preferences,
    alternatePath: CLOUD_QUEUE_PATH,
  });
}

type Answer = { title: string; body: string | null };

function invalidAnswerOf(language: Language): Answer {
  const { invalidTitle, invalidBody } = CLOUD_PAGE_COPY_BY_LANGUAGE[language].queuePage;
  return { title: invalidTitle, body: invalidBody };
}

function answerOfNotice({ notice, language }: { notice: CloudQueueNotice; language: Language }): Answer | null {
  const { queuePage } = CLOUD_PAGE_COPY_BY_LANGUAGE[language];
  const answers: Record<CloudQueueNotice, Answer | null> = {
    [CloudQueueNotice.None]: null,
    [CloudQueueNotice.TryAgain]: null,
    [CloudQueueNotice.Queued]: { title: queuePage.queuedTitle, body: queuePage.queuedBody },
    [CloudQueueNotice.Closed]: { title: queuePage.closed, body: null },
    [CloudQueueNotice.Forbidden]: { title: queuePage.forbidden, body: null },
    [CloudQueueNotice.Invalid]: invalidAnswerOf(language),
  };
  return answers[notice];
}

export function cloudQueuePageResponse({
  notice,
  siteKey,
  form,
  preferences,
}: {
  notice: CloudQueueNotice;
  siteKey: string | null;
  form: CloudQueueForm | null;
  preferences: PagePreferences;
}): Response {
  const usableSiteKey = usableSiteKeyOf(siteKey);
  const page = pageOf({ notice, usableSiteKey, form, language: preferences.language });
  const response = adminPageResponse({
    html: documentHtml({ content: page.content, preferences }),
    contentSecurityPolicy: page.hasChallenge ? CHALLENGE_CONTENT_SECURITY_POLICY : CONTENT_SECURITY_POLICY,
  });
  return new Response(response.body, { status: page.status, headers: response.headers });
}

function pageOf({
  notice,
  usableSiteKey,
  form,
  language,
}: {
  notice: CloudQueueNotice;
  usableSiteKey: string | null;
  form: CloudQueueForm | null;
  language: Language;
}): {
  content: string;
  hasChallenge: boolean;
  status: HttpStatus;
} {
  const answer = answerOfNotice({ notice, language });
  if (answer !== null) {
    return { content: answerHtml({ ...answer, language }), hasChallenge: false, status: STATUS_OF_CLOUD_QUEUE_NOTICE[notice] };
  }
  if (usableSiteKey === null || form === null) {
    return {
      content: answerHtml({ ...invalidAnswerOf(language), language }),
      hasChallenge: false,
      status: STATUS_OF_CLOUD_QUEUE_NOTICE[CloudQueueNotice.Invalid],
    };
  }
  const formNotice = notice === CloudQueueNotice.TryAgain ? CLOUD_PAGE_COPY_BY_LANGUAGE[language].queuePage.tryAgain : null;
  return {
    content: formHtml({ notice: formNotice, siteKey: usableSiteKey, form, language }),
    hasChallenge: true,
    status: STATUS_OF_CLOUD_QUEUE_NOTICE[notice],
  };
}
