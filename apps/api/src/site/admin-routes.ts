import { digestCredential } from '../credential-digest';
import type { Env } from '../env';
import { HttpMethod } from '../http-method';
import { HttpStatus } from '../http-status';
import { adminCardAnswerOf, adminPageAnswerOf, adminRedirectAnswerOf } from './admin-answer';
import { serveAdminExport } from './admin-export';
import { serveAdminLinkPage } from './admin-link-page';
import { serveAdminPanel } from './admin-page';
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
import { deleteAdminSession, waitlistSummaryOf } from './admin-store';
import { AdminNotice } from './admin-waitlist';
import type { SiteContext, SiteRoute } from './site-endpoint';
import { waitlistSiteKeyOf } from './waitlist-join';

export type AdminRoute = { method: HttpMethod; path: AdminPath; route: SiteRoute };

function closedCardOf(env: Env): Promise<Response> {
  return adminCardAnswerOf({ notice: AdminNotice.Closed, siteKey: waitlistSiteKeyOf(env) });
}

async function servePanel({ request, env }: SiteContext): Promise<Response> {
  if (adminEmailOf(env) === null) return closedCardOf(env);
  const isSignedIn = await hasAdminSession({ request, env, now: Date.now() }).catch(() => null);
  if (isSignedIn === null) return closedCardOf(env);
  if (!isSignedIn) return adminCardAnswerOf({ notice: AdminNotice.None, siteKey: waitlistSiteKeyOf(env) });
  const summary = await waitlistSummaryOf({ database: env.DIRECTORY, now: Date.now() }).catch(() => null);
  if (summary === null) return closedCardOf(env);
  return adminPageAnswerOf({ page: await serveAdminPanel({ summary }), status: HttpStatus.Ok });
}

async function serveLinkPage(): Promise<Response> {
  return adminPageAnswerOf({ page: await serveAdminLinkPage(), status: HttpStatus.Ok });
}

async function serveSignOut({ request, env }: SiteContext): Promise<Response> {
  if (!isSameOriginPost({ request, env })) return adminCardAnswerOf({ notice: AdminNotice.Forbidden, siteKey: waitlistSiteKeyOf(env) });
  const signedOut = adminRedirectAnswerOf({ cookies: [clearedAdminCookieHeaderOf({ cookie: AdminCookie.Session })] });
  const secret = adminCookieValueOf({ request, cookie: AdminCookie.Session });
  if (secret === null) return signedOut;
  const isDeleted = await deleteAdminSession({ database: env.DIRECTORY, digest: await digestCredential(secret) })
    .then(() => true)
    .catch(() => false);
  if (!isDeleted) return closedCardOf(env);
  return signedOut;
}

export const ADMIN_ROUTES: AdminRoute[] = [
  { method: HttpMethod.Get, path: AdminPath.Panel, route: servePanel },
  { method: HttpMethod.Head, path: AdminPath.Panel, route: servePanel },
  { method: HttpMethod.Get, path: AdminPath.LinkPage, route: serveLinkPage },
  { method: HttpMethod.Head, path: AdminPath.LinkPage, route: serveLinkPage },
  { method: HttpMethod.Get, path: AdminPath.Export, route: serveAdminExport },
  { method: HttpMethod.Post, path: AdminPath.SignInLinks, route: serveAdminSignInLink },
  { method: HttpMethod.Post, path: AdminPath.Sessions, route: serveAdminSession },
  { method: HttpMethod.Post, path: AdminPath.SignOut, route: serveSignOut },
];
