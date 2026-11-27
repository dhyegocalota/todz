import { digestCredential } from '../credential-digest';
import { HttpMethod } from '../http-method';
import { HttpStatus } from '../http-status';
import { siteKeyOf } from '../turnstile-page';
import { adminCardAnswerOf, adminClosedAnswerOf, adminPageAnswerOf, adminRedirectAnswerOf } from './admin-answer';
import { serveAdminCloudAdmissions } from './admin-cloud-admissions';
import { serveAdminCloudQueue } from './admin-cloud-queue';
import { serveAdminLinkPage } from './admin-link-page';
import { serveAdminMetrics, serveAdminMetricsExport } from './admin-metrics';
import { AdminNotice } from './admin-notice';
import { AdminPath } from './admin-paths';
import {
  AdminCookie,
  adminCookieValueOf,
  adminEmailOf,
  clearedAdminCookieHeaderOf,
  hasAdminSession,
  isSameOriginPost,
} from './admin-session';
import { serveAdminSession, serveAdminSignInLink } from './admin-sign-in';
import { deleteAdminSession } from './admin-store';
import { serveAdminStoredTextReset } from './admin-stored-text-reset';
import { serveAdminSuspension } from './admin-suspension';
import { serveAdminUsage } from './admin-usage';
import type { SiteContext, SiteRoute } from './site-endpoint';

export type AdminRoute = { method: HttpMethod; path: AdminPath; route: SiteRoute };

async function servePanel({ request, env }: SiteContext): Promise<Response> {
  if (adminEmailOf(env) === null) return adminClosedAnswerOf({ request, env });
  const isSignedIn = await hasAdminSession({ request, env, now: Date.now() }).catch(() => null);
  if (isSignedIn === null) return adminClosedAnswerOf({ request, env });
  if (!isSignedIn) return adminCardAnswerOf({ request, notice: AdminNotice.None, siteKey: siteKeyOf(env) });
  return adminRedirectAnswerOf({ location: AdminPath.Metrics });
}

async function serveLinkPage({ request }: SiteContext): Promise<Response> {
  return adminPageAnswerOf({ page: await serveAdminLinkPage({ request }), status: HttpStatus.Ok });
}

async function serveSignOut({ request, env }: SiteContext): Promise<Response> {
  if (!isSameOriginPost({ request, env })) return adminCardAnswerOf({ request, notice: AdminNotice.Forbidden, siteKey: siteKeyOf(env) });
  const cookies = [clearedAdminCookieHeaderOf({ cookie: AdminCookie.Session })];
  const signedOut = adminRedirectAnswerOf({ cookies });
  const secret = adminCookieValueOf({ request, cookie: AdminCookie.Session });
  if (secret === null) return signedOut;
  const isDeleted = await deleteAdminSession({ database: env.DIRECTORY, digest: await digestCredential(secret) })
    .then(() => true)
    .catch(() => false);
  if (!isDeleted) return adminClosedAnswerOf({ request, env, cookies });
  return signedOut;
}

export const ADMIN_ROUTES: AdminRoute[] = [
  { method: HttpMethod.Get, path: AdminPath.Panel, route: servePanel },
  { method: HttpMethod.Head, path: AdminPath.Panel, route: servePanel },
  { method: HttpMethod.Get, path: AdminPath.LinkPage, route: serveLinkPage },
  { method: HttpMethod.Head, path: AdminPath.LinkPage, route: serveLinkPage },
  { method: HttpMethod.Get, path: AdminPath.Metrics, route: serveAdminMetrics },
  { method: HttpMethod.Head, path: AdminPath.Metrics, route: serveAdminMetrics },
  { method: HttpMethod.Get, path: AdminPath.MetricsExport, route: serveAdminMetricsExport },
  { method: HttpMethod.Get, path: AdminPath.Usage, route: serveAdminUsage },
  { method: HttpMethod.Head, path: AdminPath.Usage, route: serveAdminUsage },
  { method: HttpMethod.Get, path: AdminPath.CloudQueue, route: serveAdminCloudQueue },
  { method: HttpMethod.Head, path: AdminPath.CloudQueue, route: serveAdminCloudQueue },
  { method: HttpMethod.Post, path: AdminPath.CloudAdmissions, route: serveAdminCloudAdmissions },
  { method: HttpMethod.Post, path: AdminPath.Suspensions, route: serveAdminSuspension },
  { method: HttpMethod.Post, path: AdminPath.StoredTextResets, route: serveAdminStoredTextReset },
  { method: HttpMethod.Post, path: AdminPath.SignInLinks, route: serveAdminSignInLink },
  { method: HttpMethod.Post, path: AdminPath.Sessions, route: serveAdminSession },
  { method: HttpMethod.Post, path: AdminPath.SignOut, route: serveSignOut },
];
