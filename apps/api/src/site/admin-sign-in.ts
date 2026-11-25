import { z } from 'zod';
import { digestCredential } from '../credential-digest';
import { generateCredentialSecret } from '../credential-secret';
import { normalizedAddress } from '../email-address';
import { type EmailSender, emailSenderOf } from '../email-sender';
import { adminSignInMail } from '../emails/admin-sign-in-mail';
import type { Env } from '../env';
import { HttpStatus } from '../http-status';
import { isLocalSiteHost } from '../local-origin';
import { MediaType, hasMediaType, isBoundedRequest } from '../request-body';
import { publicOriginOf } from '../sign-in-links';
import { TURNSTILE_TOKEN_PATTERN, TurnstileAction, TurnstileVerdict, verifyTurnstileToken } from '../turnstile';
import { adminJsonAnswerOf, adminPageAnswerOf } from './admin-answer';
import {
  AdminLimit,
  type AdminRefusal,
  adminAddressRefusal,
  adminClientRefusal,
  adminGlobalRefusal,
  isAdminUnguarded,
} from './admin-limiter';
import { AdminField, AdminPath } from './admin-paths';
import { serveAdminSignInPage } from './admin-page';
import {
  ADMIN_SESSION_LIFETIME_MS,
  ADMIN_SIGN_IN_LINK_LIFETIME_MS,
  AdminCookie,
  adminCookieHeaderOf,
  adminCookieValueOf,
  adminEmailOf,
  clearedAdminCookieHeaderOf,
  isSameOriginPost,
} from './admin-session';
import { deleteAdminLink, insertAdminLinkWithinLimit, openAdminSession, spendAdminLink } from './admin-store';
import { AdminNotice } from './admin-waitlist';
import type { SiteContext } from './site-endpoint';
import { waitlistSiteKeyOf } from './waitlist-join';

const ADMIN_LINKS_PER_WINDOW_MAX = 5;
const TURNSTILE_FIELD = 'cf-turnstile-response';
const LINK_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const LinkFormSchema = z.object({ [AdminField.Email]: z.string(), [TURNSTILE_FIELD]: z.string() });

const SessionBodySchema = z.object({ [AdminField.Token]: z.string() });

type AdminLinkGuard = { adminEmail: string; siteOrigin: string; secret: string; sender: EmailSender };

type AdminLinkAsk = { address: string; guard: AdminLinkGuard };

const STATUS_OF_NOTICE: Record<AdminNotice, HttpStatus> = {
  [AdminNotice.None]: HttpStatus.Ok,
  [AdminNotice.CheckInbox]: HttpStatus.Ok,
  [AdminNotice.TryAgain]: HttpStatus.TooManyRequests,
  [AdminNotice.Closed]: HttpStatus.Unavailable,
  [AdminNotice.Forbidden]: HttpStatus.Forbidden,
};

const REFUSAL_OF_VERDICT: Record<TurnstileVerdict, AdminRefusal | null> = {
  [TurnstileVerdict.Accepted]: null,
  [TurnstileVerdict.Refused]: AdminNotice.TryAgain,
  [TurnstileVerdict.Unavailable]: AdminNotice.Closed,
};

// NB ADR 0051: the link request answers closed, before any limit or body read, unless the admin address, the site origin, both Turnstile keys, a mail sender, the three limiters and the client address are there.
function adminLinkGuardOf({ request, env }: { request: Request; env: Env }): AdminLinkGuard | null {
  const adminEmail = adminEmailOf(env);
  const siteOrigin = publicOriginOf(env.SITE_ORIGIN);
  const { TURNSTILE_SECRET_KEY: secret } = env;
  if (adminEmail === null) return null;
  if (siteOrigin === null) return null;
  if (secret === undefined) return null;
  if (waitlistSiteKeyOf(env) === null) return null;
  if (isAdminUnguarded({ request, env, limits: Object.values(AdminLimit) })) return null;
  const sender = emailSenderOf({ configured: env.EMAIL_SENDER, publicOrigin: siteOrigin, requestUrl: request.url, binding: env.EMAIL });
  if (sender === null) return null;
  return { adminEmail, siteOrigin, secret, sender };
}

async function linkFormOf(request: Request): Promise<z.output<typeof LinkFormSchema> | null> {
  const isReadableForm = isBoundedRequest(request) && hasMediaType({ request, mediaType: MediaType.Form });
  if (!isReadableForm) return null;
  const parsed = LinkFormSchema.safeParse(Object.fromEntries(new URLSearchParams(await request.text())));
  if (!parsed.success) return null;
  return parsed.data;
}

async function linkAskOf({ request, env }: { request: Request; env: Env }): Promise<AdminLinkAsk | AdminNotice> {
  const guard = adminLinkGuardOf({ request, env });
  if (guard === null) return AdminNotice.Closed;
  if (!isSameOriginPost({ request, env })) return AdminNotice.Forbidden;
  const clientRefusal = await adminClientRefusal({ request, env, path: AdminPath.SignInLinks });
  if (clientRefusal !== null) return clientRefusal;
  const form = await linkFormOf(request);
  if (form === null) return AdminNotice.TryAgain;
  const address = normalizedAddress(form[AdminField.Email]);
  if (address === null) return AdminNotice.TryAgain;
  const token = form[TURNSTILE_FIELD];
  if (!TURNSTILE_TOKEN_PATTERN.test(token)) return AdminNotice.TryAgain;
  const verdict = await verifyTurnstileToken({
    token,
    secret: guard.secret,
    hostname: new URL(guard.siteOrigin).hostname,
    action: TurnstileAction.AdminSignIn,
    isLocalHost: isLocalSiteHost({ env, request }),
    fetcher: fetch,
  });
  const challengeRefusal = REFUSAL_OF_VERDICT[verdict];
  if (challengeRefusal !== null) return challengeRefusal;
  const globalRefusal = await adminGlobalRefusal({ request, env });
  if (globalRefusal !== null) return globalRefusal;
  const addressRefusal = await adminAddressRefusal({ request, env, address });
  if (addressRefusal !== null) return addressRefusal;
  return { address, guard };
}

async function issueAdminLink({
  database,
  guard,
  challenge,
}: {
  database: D1Database;
  guard: AdminLinkGuard;
  challenge: string;
}): Promise<void> {
  const token = generateCredentialSecret();
  const digest = await digestCredential(token);
  const now = Date.now();
  const isStored = await insertAdminLinkWithinLimit({
    database,
    digest,
    email: guard.adminEmail,
    challenge: await digestCredential(challenge),
    now,
    expiresAt: now + ADMIN_SIGN_IN_LINK_LIFETIME_MS,
    windowStart: now - ADMIN_SIGN_IN_LINK_LIFETIME_MS,
    linksPerWindowMax: ADMIN_LINKS_PER_WINDOW_MAX,
  });
  if (!isStored) return;
  const link = `${guard.siteOrigin}${AdminPath.LinkPage}#${AdminField.Token}=${token}`;
  try {
    await guard.sender.send(adminSignInMail({ to: guard.adminEmail, link, origin: guard.siteOrigin }));
  } catch {
    await deleteAdminLink({ database, digest });
  }
}

// NB ADR 0051: the answer, its cookie and its status are built before D1 or the sender is touched, so neither the time nor a failure tells the admin's address apart.
export async function serveAdminSignInLink({ request, env, executionContext }: SiteContext): Promise<Response> {
  const ask = await linkAskOf({ request, env });
  const siteKey = waitlistSiteKeyOf(env);
  const isRefused = typeof ask === 'string';
  if (isRefused) return adminPageAnswerOf({ page: await serveAdminSignInPage({ notice: ask, siteKey }), status: STATUS_OF_NOTICE[ask] });
  const challenge = generateCredentialSecret();
  const answer = adminPageAnswerOf({
    page: await serveAdminSignInPage({ notice: AdminNotice.CheckInbox, siteKey }),
    status: STATUS_OF_NOTICE[AdminNotice.CheckInbox],
    cookies: [adminCookieHeaderOf({ cookie: AdminCookie.Challenge, value: challenge })],
  });
  const isAdminAddress = ask.address === ask.guard.adminEmail;
  if (isAdminAddress) {
    const issuance = issueAdminLink({ database: env.DIRECTORY, guard: ask.guard, challenge });
    executionContext.waitUntil(issuance.catch(() => undefined));
  }
  return answer;
}

async function sessionTokenOf(request: Request): Promise<string | null> {
  const isReadableJson = isBoundedRequest(request) && hasMediaType({ request, mediaType: MediaType.Json });
  if (!isReadableJson) return null;
  const parsed = SessionBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return null;
  const token = parsed.data[AdminField.Token];
  if (!LINK_TOKEN_PATTERN.test(token)) return null;
  return token;
}

// NB ADR 0051: one statement spends the link, and only for the token, the challenge cookie and the admin address together.
export async function serveAdminSession({ request, env }: SiteContext): Promise<Response> {
  const adminEmail = adminEmailOf(env);
  if (adminEmail === null) return adminJsonAnswerOf({ status: HttpStatus.Unavailable });
  if (isAdminUnguarded({ request, env, limits: [AdminLimit.Client] })) return adminJsonAnswerOf({ status: HttpStatus.Unavailable });
  if (!isSameOriginPost({ request, env })) return adminJsonAnswerOf({ status: HttpStatus.Forbidden });
  const clientRefusal = await adminClientRefusal({ request, env, path: AdminPath.Sessions });
  if (clientRefusal !== null) return adminJsonAnswerOf({ status: STATUS_OF_NOTICE[clientRefusal] });
  const token = await sessionTokenOf(request);
  const challenge = adminCookieValueOf({ request, cookie: AdminCookie.Challenge });
  if (token === null) return adminJsonAnswerOf({ status: HttpStatus.Unauthorized });
  if (challenge === null) return adminJsonAnswerOf({ status: HttpStatus.Unauthorized });
  const now = Date.now();
  const isSpent = await spendAdminLink({
    database: env.DIRECTORY,
    digest: await digestCredential(token),
    challenge: await digestCredential(challenge),
    email: adminEmail,
    now,
  }).catch(() => null);
  if (isSpent === null) return adminJsonAnswerOf({ status: HttpStatus.Unavailable });
  if (!isSpent) return adminJsonAnswerOf({ status: HttpStatus.Unauthorized });
  const secret = generateCredentialSecret();
  const isOpened = await openAdminSession({
    database: env.DIRECTORY,
    digest: await digestCredential(secret),
    email: adminEmail,
    now,
    expiresAt: now + ADMIN_SESSION_LIFETIME_MS,
  })
    .then(() => true)
    .catch(() => false);
  if (!isOpened) return adminJsonAnswerOf({ status: HttpStatus.Unavailable });
  return adminJsonAnswerOf({
    status: HttpStatus.Created,
    cookies: [
      adminCookieHeaderOf({ cookie: AdminCookie.Session, value: secret }),
      clearedAdminCookieHeaderOf({ cookie: AdminCookie.Challenge }),
    ],
  });
}
