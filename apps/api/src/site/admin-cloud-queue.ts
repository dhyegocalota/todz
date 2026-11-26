import { CLOUD_QUEUE_ADMIN_ROWS_MAX } from '@todz/types';
import { type QueuedAddress, waitingAddresses } from '../cloud-queue-store';
import { escapedHtml } from '../escaped-html';
import { HttpStatus } from '../http-status';
import { siteKeyOf } from '../turnstile-page';
import { adminCardAnswerOf, adminClosedAnswerOf, adminPageAnswerOf } from './admin-answer';
import { ADMIN_COPY } from './admin-copy';
import { AdminNotice } from './admin-notice';
import { AdminField, AdminPath } from './admin-paths';
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

function rowHtml(queued: QueuedAddress): string {
  const { cloudQueue } = ADMIN_COPY;
  const address = escapedHtml(queued.email);
  const joined = new Date(queued.createdAt).toISOString();
  return `<tr><td>${address}</td><td>${escapedHtml(joined)}</td><td><form method="post" action="${AdminPath.CloudAdmissions}"><input type="hidden" name="${AdminField.Email}" value="${address}"><button class="nav-link nav-button" type="submit">${escapedHtml(cloudQueue.admit)}</button></form></td></tr>`;
}

function tableHtml(waiting: QueuedAddress[]): string {
  const { cloudQueue } = ADMIN_COPY;
  if (waiting.length === 0) return `<p class="empty-body">${escapedHtml(cloudQueue.empty)}</p>`;
  const { columns } = cloudQueue;
  return `<div class="usage-scroll"><table class="usage-table"><thead><tr><th>${escapedHtml(columns.address)}</th><th>${escapedHtml(columns.joined)}</th><th>${escapedHtml(columns.action)}</th></tr></thead><tbody>${waiting.map(rowHtml).join('')}</tbody></table></div>`;
}

function admitNextHtml(): string {
  const { cloudQueue } = ADMIN_COPY;
  return `<form method="post" action="${AdminPath.CloudAdmissions}"><label>${escapedHtml(cloudQueue.admitNextLabel)} <input type="number" name="${AdminField.Count}" min="1" max="${CLOUD_QUEUE_ADMIN_ROWS_MAX}" value="1"></label> <button class="nav-link nav-button" type="submit">${escapedHtml(cloudQueue.admitNext)}</button></form>`;
}

function queueHtml(waiting: QueuedAddress[]): string {
  const { cloudQueue, panel } = ADMIN_COPY;
  return siteDocumentHtml({
    kind: SitePageKind.Private,
    title: cloudQueue.title,
    description: ADMIN_COPY.meta.description,
    main: `<main id="${CONTENT_ID}">
<div class="admin-panel rise">
<div class="panel-head">
<h1 class="panel-title">${escapedHtml(cloudQueue.title)}</h1>
<nav class="panel-actions" aria-label="${escapedHtml(ADMIN_COPY.shell.navLabel)}">
<a class="admin-action" href="${AdminPath.Panel}">${escapedHtml(cloudQueue.back)}</a>
<form method="post" action="${AdminPath.SignOut}"><button class="nav-link nav-button" type="submit">${escapedHtml(panel.signOut)}</button></form>
</nav>
</div>
${admitNextHtml()}
${tableHtml(waiting)}
</div>
</main>`,
    scripts: [],
  });
}

export async function serveAdminCloudQueue({ request, env }: SiteContext): Promise<Response> {
  if (adminEmailOf(env) === null) return adminClosedAnswerOf({ env });
  const isSignedIn = await hasAdminSession({ request, env, now: Date.now() }).catch(() => null);
  if (isSignedIn === null) return adminClosedAnswerOf({ env });
  if (!isSignedIn) return adminCardAnswerOf({ notice: AdminNotice.None, siteKey: siteKeyOf(env) });
  const waiting = await waitingAddresses({ directory: env.DIRECTORY, limit: CLOUD_QUEUE_ADMIN_ROWS_MAX }).catch(() => null);
  if (waiting === null) return adminClosedAnswerOf({ env });
  const page = adminPageResponse({ html: queueHtml(waiting), contentSecurityPolicy: CONTENT_SECURITY_POLICY });
  return adminPageAnswerOf({ page, status: HttpStatus.Ok });
}
