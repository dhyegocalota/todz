import { WAITLIST_RATE_LIMIT_PERIOD_SECONDS } from '@todz/types';
import { z } from 'zod';
import { isOwnDomainAddress, normalizedAddress } from '../email-address';
import { type EmailSender, emailSenderOf } from '../email-sender';
import { waitlistMail } from '../emails/waitlist-mail';
import type { Env } from '../env';
import { HttpHeader } from '../http-header';
import { HttpStatus } from '../http-status';
import { isLocalSiteHost } from '../local-origin';
import { MediaType, hasMediaType, isBoundedRequest } from '../request-body';
import { publicOriginOf } from '../sign-in-links';
import { TURNSTILE_TOKEN_PATTERN, TurnstileAction, TurnstileVerdict, verifyTurnstileToken } from '../turnstile';
import { TURNSTILE_RESPONSE_FIELD, siteKeyOf } from '../turnstile-page';
import { LandingNotice, serveLandingPage } from './landing-page';
import type { SiteContext } from './site-endpoint';
import {
  type WaitlistRefusal,
  isWaitlistUnguarded,
  waitlistAddressRefusal,
  waitlistClientRefusal,
  waitlistGlobalRefusal,
} from './waitlist-limiter';
import { joinWaitlist, recordConfirmationFailure } from './waitlist-store';

const JoinFormSchema = z.object({ email: z.string(), [TURNSTILE_RESPONSE_FIELD]: z.string() });

type JoinForm = z.output<typeof JoinFormSchema>;

type JoinNotice = LandingNotice.Joined | WaitlistRefusal;

type WaitlistGuard = { siteOrigin: string; secret: string; sender: EmailSender };

const STATUS_OF_NOTICE: Record<JoinNotice, HttpStatus> = {
  [LandingNotice.Joined]: HttpStatus.Ok,
  [LandingNotice.TryAgain]: HttpStatus.TooManyRequests,
  [LandingNotice.OpensSoon]: HttpStatus.Unavailable,
};

const REFUSAL_OF_VERDICT: Record<TurnstileVerdict, WaitlistRefusal | null> = {
  [TurnstileVerdict.Accepted]: null,
  [TurnstileVerdict.Refused]: LandingNotice.TryAgain,
  [TurnstileVerdict.Unavailable]: LandingNotice.OpensSoon,
};

// NB ADR 0050: the join answers opens soon, before any limit or body read, unless its origin, both Turnstile keys, a mail sender, the limiters and the client address are there.
function waitlistGuardOf({ request, env }: { request: Request; env: Env }): WaitlistGuard | null {
  const siteOrigin = publicOriginOf(env.SITE_ORIGIN);
  const { TURNSTILE_SECRET_KEY: secret } = env;
  if (siteOrigin === null) return null;
  if (secret === undefined) return null;
  if (siteKeyOf(env) === null) return null;
  if (isWaitlistUnguarded({ request, env })) return null;
  const sender = emailSenderOf({ configured: env.EMAIL_SENDER, publicOrigin: siteOrigin, requestUrl: request.url, binding: env.EMAIL });
  if (sender === null) return null;
  return { siteOrigin, secret, sender };
}

async function joinFormOf(request: Request): Promise<JoinForm | null> {
  const isReadableForm = isBoundedRequest(request) && hasMediaType({ request, mediaType: MediaType.Form });
  if (!isReadableForm) return null;
  const parsed = JoinFormSchema.safeParse(Object.fromEntries(new URLSearchParams(await request.text())));
  if (!parsed.success) return null;
  return parsed.data;
}

async function sendConfirmation({
  sender,
  database,
  address,
  siteOrigin,
}: {
  sender: EmailSender;
  database: D1Database;
  address: string;
  siteOrigin: string;
}): Promise<void> {
  try {
    await sender.send(waitlistMail({ to: address, origin: siteOrigin }));
  } catch {
    await recordConfirmationFailure({ database, address, now: Date.now() });
  }
}

async function joinNoticeOf({ request, env, executionContext }: SiteContext): Promise<JoinNotice> {
  const guard = waitlistGuardOf({ request, env });
  if (guard === null) return LandingNotice.OpensSoon;
  const clientRefusal = await waitlistClientRefusal({ request, env });
  if (clientRefusal !== null) return clientRefusal;
  const form = await joinFormOf(request);
  if (form === null) return LandingNotice.TryAgain;
  const address = normalizedAddress(form.email);
  if (address === null) return LandingNotice.TryAgain;
  const token = form[TURNSTILE_RESPONSE_FIELD];
  if (!TURNSTILE_TOKEN_PATTERN.test(token)) return LandingNotice.TryAgain;
  const verdict = await verifyTurnstileToken({
    token,
    secret: guard.secret,
    hostname: new URL(guard.siteOrigin).hostname,
    action: TurnstileAction.Waitlist,
    isLocalHost: isLocalSiteHost({ env, request }),
    fetcher: fetch,
  });
  const challengeRefusal = REFUSAL_OF_VERDICT[verdict];
  if (challengeRefusal !== null) return challengeRefusal;
  const globalRefusal = await waitlistGlobalRefusal({ request, env });
  if (globalRefusal !== null) return globalRefusal;
  const addressRefusal = await waitlistAddressRefusal({ request, env, address });
  if (addressRefusal !== null) return addressRefusal;
  if (isOwnDomainAddress(address)) return LandingNotice.Joined;
  const isClaimed = await joinWaitlist({ database: env.DIRECTORY, address, now: Date.now() }).catch(() => null);
  if (isClaimed === null) return LandingNotice.TryAgain;
  if (!isClaimed) return LandingNotice.Joined;
  const confirmation = sendConfirmation({ sender: guard.sender, database: env.DIRECTORY, address, siteOrigin: guard.siteOrigin });
  executionContext.waitUntil(confirmation.catch(() => undefined));
  return LandingNotice.Joined;
}

export async function serveWaitlistJoin(context: SiteContext): Promise<Response> {
  const notice = await joinNoticeOf(context);
  const page = await serveLandingPage({ notice, siteKey: siteKeyOf(context.env) });
  const answer = new Response(page.body, { status: STATUS_OF_NOTICE[notice], headers: page.headers });
  if (notice === LandingNotice.TryAgain) answer.headers.set(HttpHeader.RetryAfter, String(WAITLIST_RATE_LIMIT_PERIOD_SECONDS));
  return answer;
}
