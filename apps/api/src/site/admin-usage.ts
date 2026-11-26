import { BYTES_PER_MEBIBYTE, FORMATTER_LOCALE, MILLISECONDS_PER_DAY } from '@todz/types';
import { escapedHtml } from '../escaped-html';
import { HttpStatus } from '../http-status';
import { siteKeyOf } from '../turnstile-page';
import { utcDayOf } from '../telemetry/telemetry-day';
import { type OwnerUsageRecord, UsageRanking, topOwnerUsage } from '../owner-usage-store';
import { adminCardAnswerOf, adminClosedAnswerOf, adminPageAnswerOf } from './admin-answer';
import { ADMIN_COPY } from './admin-copy';
import { AdminField, AdminPath } from './admin-paths';
import { SuspensionChoice } from './admin-suspension';
import { adminEmailOf, hasAdminSession } from './admin-session';
import { AdminNotice } from './admin-waitlist';
import { adminPageResponse, siteContentSecurityPolicy } from './site-headers';
import { CONTENT_ID, SitePageKind, siteDocumentHtml } from './site-shell';
import { SITE_STYLE } from './site-style';
import type { SiteContext } from './site-endpoint';

const ADMIN_USAGE_DAYS = 7;
const ADMIN_USAGE_ROWS_MAX = 25;
const COUNT_FORMAT = new Intl.NumberFormat(FORMATTER_LOCALE);
const MEBIBYTE_FORMAT = new Intl.NumberFormat(FORMATTER_LOCALE, { maximumFractionDigits: 2 });

const CONTENT_SECURITY_POLICY = await siteContentSecurityPolicy({
  style: SITE_STYLE,
  scripts: [],
  widgetOrigin: null,
  connectsToSelf: false,
  declaresManifest: false,
});

function sinceDayOf(now: number): string {
  return utcDayOf(now - (ADMIN_USAGE_DAYS - 1) * MILLISECONDS_PER_DAY);
}

function accountHtml(owner: OwnerUsageRecord): string {
  const address = owner.email === null ? ADMIN_COPY.usage.noAddress : owner.email;
  return `<span class="account-id">${escapedHtml(owner.ownerId)}</span><br><span class="account-address">${escapedHtml(address)}</span>`;
}

function suspensionFormHtml(owner: OwnerUsageRecord): string {
  const { usage } = ADMIN_COPY;
  const state = owner.isSuspended ? usage.suspended : usage.active;
  const choice = owner.isSuspended ? SuspensionChoice.Restore : SuspensionChoice.Suspend;
  const label = owner.isSuspended ? usage.restore : usage.suspend;
  return `<td>${escapedHtml(state)}</td><td><form method="post" action="${AdminPath.Suspensions}"><input type="hidden" name="${AdminField.Owner}" value="${escapedHtml(owner.ownerId)}"><button class="nav-link nav-button" name="${AdminField.Choice}" value="${choice}" type="submit">${escapedHtml(label)}</button></form><form method="post" action="${AdminPath.StoredTextResets}"><input type="hidden" name="${AdminField.Owner}" value="${escapedHtml(owner.ownerId)}"><button class="nav-link nav-button" type="submit">${escapedHtml(usage.resetStoredText)}</button></form></td>`;
}

function rowsHtml(owners: OwnerUsageRecord[]): string {
  const { usage } = ADMIN_COPY;
  if (owners.length === 0) return `<p class="empty-body">${escapedHtml(usage.empty)}</p>`;
  const rows = owners.map(
    (owner) =>
      `<tr><td>${accountHtml(owner)}</td><td>${COUNT_FORMAT.format(owner.writes)}</td><td>${MEBIBYTE_FORMAT.format(owner.bytes / BYTES_PER_MEBIBYTE)} ${usage.mebibyteUnit}</td>${suspensionFormHtml(owner)}</tr>`,
  );
  return `<table class="usage-table"><thead><tr><th>${escapedHtml(usage.columns.account)}</th><th>${escapedHtml(usage.columns.writes)}</th><th>${escapedHtml(usage.columns.bytes)}</th><th>${escapedHtml(usage.columns.state)}</th><th>${escapedHtml(usage.columns.action)}</th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
}

function usageHtml({ byWrites, byBytes }: { byWrites: OwnerUsageRecord[]; byBytes: OwnerUsageRecord[] }): string {
  const { usage, panel } = ADMIN_COPY;
  return siteDocumentHtml({
    kind: SitePageKind.Private,
    title: usage.title,
    description: ADMIN_COPY.meta.description,
    main: `<main id="${CONTENT_ID}">
<div class="admin-panel rise">
<div class="panel-head">
<h1 class="panel-title">${escapedHtml(usage.title)}</h1>
<nav class="panel-actions" aria-label="${escapedHtml(ADMIN_COPY.shell.navLabel)}">
<a class="admin-action" href="${AdminPath.Panel}">${escapedHtml(usage.back)}</a>
<form method="post" action="${AdminPath.SignOut}"><button class="nav-link nav-button" type="submit">${escapedHtml(panel.signOut)}</button></form>
</nav>
</div>
<h2>${escapedHtml(usage.writesHeading)}</h2>
${rowsHtml(byWrites)}
<h2>${escapedHtml(usage.bytesHeading)}</h2>
${rowsHtml(byBytes)}
</div>
</main>`,
    scripts: [],
  });
}

export async function serveAdminUsage({ request, env }: SiteContext): Promise<Response> {
  if (adminEmailOf(env) === null) return adminClosedAnswerOf({ env });
  const isSignedIn = await hasAdminSession({ request, env, now: Date.now() }).catch(() => null);
  if (isSignedIn === null) return adminClosedAnswerOf({ env });
  if (!isSignedIn) return adminCardAnswerOf({ notice: AdminNotice.None, siteKey: siteKeyOf(env) });
  const now = Date.now();
  const query = { directory: env.DIRECTORY, sinceDay: sinceDayOf(now), limit: ADMIN_USAGE_ROWS_MAX };
  const lists = await Promise.all([
    topOwnerUsage({ ...query, ranking: UsageRanking.Writes }),
    topOwnerUsage({ ...query, ranking: UsageRanking.Bytes }),
  ]).catch(() => null);
  if (lists === null) return adminClosedAnswerOf({ env });
  const [byWrites, byBytes] = lists;
  const page = adminPageResponse({ html: usageHtml({ byWrites, byBytes }), contentSecurityPolicy: CONTENT_SECURITY_POLICY });
  return adminPageAnswerOf({ page, status: HttpStatus.Ok });
}
