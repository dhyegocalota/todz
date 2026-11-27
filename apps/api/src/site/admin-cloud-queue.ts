import { CLOUD_QUEUE_ADMIN_ROWS_MAX } from '@todz/types';
import { cloudAccountsMaxOf } from '../cloud-accounts-max';
import { BudgetSource, ESTIMATE_ONLY_NOTICE, budgetSourceOf, fallbackNoticeOf } from '../cloud-budget-source';
import { recordedSourceOf } from '../cloud-budget-store';
import { cloudMonthOf } from '../cloud-month';
import { type QueuedAddress, waitingAddresses } from '../cloud-queue-store';
import type { Env } from '../env';
import { escapedHtml } from '../escaped-html';
import { HttpStatus } from '../http-status';
import { siteKeyOf } from '../turnstile-page';
import { adminCardAnswerOf, adminClosedAnswerOf, adminPageAnswerOf } from './admin-answer';
import { ADMIN_COPY_BY_LANGUAGE, type AdminCopy } from './admin-copy';
import { AdminNotice } from './admin-notice';
import { adminPreferencesOf } from './admin-preferences';
import { ADMIN_NOTICE_PARAMETER, AdminField, AdminPath, CloudQueueAdminNotice } from './admin-paths';
import { adminEmailOf, hasAdminSession } from './admin-session';
import { adminPageResponse, siteContentSecurityPolicy } from './site-headers';
import type { SiteContext } from './site-endpoint';
import { CONTENT_ID, SitePageKind, siteDocumentHtml } from './site-shell';
import { SITE_STYLE } from './site-style';

const CONTENT_SECURITY_POLICY = await siteContentSecurityPolicy({
  style: SITE_STYLE,
  scripts: [],
  widgetOrigin: null,
  connectsToSelf: false,
  declaresManifest: false,
});

function rowHtml({ queued, copy }: { queued: QueuedAddress; copy: AdminCopy }): string {
  const { cloudQueue } = copy;
  const address = escapedHtml(queued.email);
  const joined = new Date(queued.createdAt).toISOString();
  return `<tr><td>${address}</td><td>${escapedHtml(joined)}</td><td><form method="post" action="${AdminPath.CloudAdmissions}"><input type="hidden" name="${AdminField.Email}" value="${address}"><button class="nav-link nav-button" type="submit">${escapedHtml(cloudQueue.admit)}</button></form></td></tr>`;
}

function tableHtml({ waiting, copy }: { waiting: QueuedAddress[]; copy: AdminCopy }): string {
  const { cloudQueue } = copy;
  if (waiting.length === 0) return `<p class="empty-body">${escapedHtml(cloudQueue.empty)}</p>`;
  const { columns } = cloudQueue;
  return `<div class="usage-scroll"><table class="usage-table"><thead><tr><th>${escapedHtml(columns.address)}</th><th>${escapedHtml(columns.joined)}</th><th>${escapedHtml(columns.action)}</th></tr></thead><tbody>${waiting.map((queued) => rowHtml({ queued, copy })).join('')}</tbody></table></div>`;
}

function admitNextHtml(copy: AdminCopy): string {
  const { cloudQueue } = copy;
  return `<form method="post" action="${AdminPath.CloudAdmissions}"><label>${escapedHtml(cloudQueue.admitNextLabel)} <input type="number" name="${AdminField.Count}" min="1" max="${CLOUD_QUEUE_ADMIN_ROWS_MAX}" value="1"></label> <button class="nav-link nav-button" type="submit">${escapedHtml(cloudQueue.admitNext)}</button></form>`;
}

async function guardNoticeOf({ env, now }: { env: Env; now: number }): Promise<string | null> {
  if (cloudAccountsMaxOf(env) === null) return null;
  if (budgetSourceOf(env).source === BudgetSource.Estimate) return ESTIMATE_ONLY_NOTICE;
  const recorded = await recordedSourceOf({ directory: env.DIRECTORY, month: cloudMonthOf(now).month });
  if (recorded === null || recorded.reason === null) return null;
  return fallbackNoticeOf(recorded.reason);
}

function noticeHtml(notice: string | null): string {
  if (notice === null) return '';
  return `<p class="empty-body">${escapedHtml(notice)}</p>`;
}

function queueHtml({ waiting, notices, request }: { waiting: QueuedAddress[]; notices: (string | null)[]; request: Request }): string {
  const preferences = adminPreferencesOf({ request });
  const copy = ADMIN_COPY_BY_LANGUAGE[preferences.language];
  const { cloudQueue, panel } = copy;
  return siteDocumentHtml({
    hasControls: true,
    kind: SitePageKind.Private,
    title: cloudQueue.title,
    description: copy.meta.description,
    main: `<main id="${CONTENT_ID}">
<div class="admin-panel rise">
<div class="panel-head">
<h1 class="panel-title">${escapedHtml(cloudQueue.title)}</h1>
<nav class="panel-actions" aria-label="${escapedHtml(copy.shell.navLabel)}">
<a class="admin-action" href="${AdminPath.Panel}">${escapedHtml(cloudQueue.back)}</a>
<form method="post" action="${AdminPath.SignOut}"><button class="nav-link nav-button" type="submit">${escapedHtml(panel.signOut)}</button></form>
</nav>
</div>
${notices.map(noticeHtml).join('')}
${admitNextHtml(copy)}
${tableHtml({ waiting, copy })}
</div>
</main>`,
    scripts: [],
    preferences,
  });
}

export async function serveAdminCloudQueue({ request, env }: SiteContext): Promise<Response> {
  if (adminEmailOf(env) === null) return adminClosedAnswerOf({ request, env });
  const isSignedIn = await hasAdminSession({ request, env, now: Date.now() }).catch(() => null);
  if (isSignedIn === null) return adminClosedAnswerOf({ request, env });
  if (!isSignedIn) return adminCardAnswerOf({ request, notice: AdminNotice.None, siteKey: siteKeyOf(env) });
  const waiting = await waitingAddresses({ directory: env.DIRECTORY, limit: CLOUD_QUEUE_ADMIN_ROWS_MAX }).catch(() => null);
  if (waiting === null) return adminClosedAnswerOf({ request, env });
  const guardNotice = await guardNoticeOf({ env, now: Date.now() }).catch(() => null);
  const isNoRoom = new URL(request.url).searchParams.get(ADMIN_NOTICE_PARAMETER) === CloudQueueAdminNotice.NoRoom;
  const copy = ADMIN_COPY_BY_LANGUAGE[adminPreferencesOf({ request }).language];
  const notices = [guardNotice, isNoRoom ? copy.cloudQueue.noRoom : null];
  const page = adminPageResponse({ html: queueHtml({ waiting, notices, request }), contentSecurityPolicy: CONTENT_SECURITY_POLICY });
  return adminPageAnswerOf({ page, status: HttpStatus.Ok });
}
