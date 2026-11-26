import { digestCredential } from '../credential-digest';
import { HttpMethod } from '../http-method';
import { HttpStatus } from '../http-status';
import { siteKeyOf } from '../turnstile-page';
import { adminCardAnswerOf, adminClosedAnswerOf, adminPageAnswerOf, adminRedirectAnswerOf } from './admin-answer';
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
import type { SiteContext, SiteRoute } from './site-endpoint';

export type AdminRoute = { method: HttpMethod; path: AdminPath; route: SiteRoute };

async function servePanel({ request, env }: SiteContext): Promise<Response> {
  if (adminEmailOf(env) === null) return adminClosedAnswerOf({ env });
  const isSignedIn = await hasAdminSession({ request, env, now: Date.now() }).catch(() => null);
  if (isSignedIn === null) return adminClosedAnswerOf({ env });
  if (!isSignedIn) return adminCardAnswerOf({ notice: AdminNotice.None, siteKey: siteKeyOf(env) });
  return adminRedirectAnswerOf({ location: AdminPath.Metrics });
}

async function serveLinkPage(): Promise<Response> {
  return adminPageAnswerOf({ page: await serveAdminLinkPage(), status: HttpStatus.Ok });
}

async function serveSignOut({ request, env }: SiteContext): Promise<Response> {
  if (!isSameOriginPost({ request, env })) return adminCardAnswerOf({ notice: AdminNotice.Forbidden, siteKey: siteKeyOf(env) });
  const cookies = [clearedAdminCookieHeaderOf({ cookie: AdminCookie.Session })];
  const signedOut = adminRedirectAnswerOf({ cookies });
  const secret = adminCookieValueOf({ request, cookie: AdminCookie.Session });
  if (secret === null) return signedOut;
  const isDeleted = await deleteAdminSession({ database: env.DIRECTORY, digest: await digestCredential(secret) })
    .then(() => true)
    .catch(() => false);
  if (!isDeleted) return adminClosedAnswerOf({ env, cookies });
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
  { method: HttpMethod.Post, path: AdminPath.SignInLinks, route: serveAdminSignInLink },
  { method: HttpMethod.Post, path: AdminPath.Sessions, route: serveAdminSession },
  { method: HttpMethod.Post, path: AdminPath.SignOut, route: serveSignOut },
];
