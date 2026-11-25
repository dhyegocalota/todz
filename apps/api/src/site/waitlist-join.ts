import { WAITLIST_RATE_LIMIT_PERIOD_SECONDS } from '@todz/types';
import { z } from 'zod';
import { isOwnDomainAddress, normalizedAddress } from '../email-address';
import { type EmailSender, emailSenderOf } from '../email-sender';
import { waitlistMail } from '../emails/waitlist-mail';
import type { Env } from '../env';
import { HttpHeader, NO_SNIFF, NO_STORE } from '../http-header';
import { HttpStatus } from '../http-status';
import { isLocalSiteHost } from '../local-origin';
import { MediaType, hasMediaType, isBoundedRequest } from '../request-body';
import { publicOriginOf } from '../sign-in-links';
import { TURNSTILE_TOKEN_PATTERN, TurnstileAction, TurnstileVerdict, verifyTurnstileToken } from '../turnstile';
import { TURNSTILE_RESPONSE_FIELD, siteKeyOf } from '../turnstile-page';
import { HONEYPOT_FIELD_NAME, JoinOutcome, STAMP_FIELD_NAME } from './join-form-markup';
import { LandingNotice, landingChallengeKeysOf, serveLandingPage } from './landing-page';
import type { SiteContext } from './site-endpoint';
import {
  type WaitlistRefusal,
  isWaitlistUnguarded,
  waitlistAddressRefusal,
  waitlistClientRefusal,
  waitlistGlobalRefusal,
} from './waitlist-limiter';
import { StampVerdict, stampVerdictOf } from './waitlist-stamp';
import { WaitlistJoin, joinWaitlistWithinLimit, recordConfirmationFailure } from './waitlist-store';

const ACCEPT_SEPARATOR = ',';
const PARAMETER_SEPARATOR = ';';
const QUALITY_PREFIX = 'q=';

const JoinFormSchema = z.object({
  email: z.string(),
  [TURNSTILE_RESPONSE_FIELD]: z.string().optional(),
  [STAMP_FIELD_NAME]: z.string().optional(),
  [HONEYPOT_FIELD_NAME]: z.string().optional(),
});

type JoinForm = z.output<typeof JoinFormSchema>;

type JoinNotice = LandingNotice.Joined | WaitlistRefusal;

type WaitlistGuard = { siteOrigin: string; secret: string; sender: EmailSender };

const STATUS_OF_NOTICE: Record<JoinNotice, HttpStatus> = {
  [LandingNotice.Joined]: HttpStatus.Ok,
  [LandingNotice.TryAgain]: HttpStatus.TooManyRequests,
  [LandingNotice.OpensSoon]: HttpStatus.Unavailable,
};

const STATUS_OF_OUTCOME: Record<JoinOutcome, HttpStatus> = {
  [JoinOutcome.Joined]: HttpStatus.Ok,
  [JoinOutcome.Invalid]: HttpStatus.BadRequest,
  [JoinOutcome.CheckFailed]: HttpStatus.Forbidden,
  [JoinOutcome.TryAgain]: HttpStatus.TooManyRequests,
  [JoinOutcome.OpensSoon]: HttpStatus.Unavailable,
};

const NOTICE_OF_OUTCOME: Record<JoinOutcome, JoinNotice> = {
  [JoinOutcome.Joined]: LandingNotice.Joined,
  [JoinOutcome.Invalid]: LandingNotice.TryAgain,
  [JoinOutcome.CheckFailed]: LandingNotice.TryAgain,
  [JoinOutcome.TryAgain]: LandingNotice.TryAgain,
  [JoinOutcome.OpensSoon]: LandingNotice.OpensSoon,
};

const OUTCOME_OF_REFUSAL: Record<WaitlistRefusal, JoinOutcome> = {
  [LandingNotice.TryAgain]: JoinOutcome.TryAgain,
  [LandingNotice.OpensSoon]: JoinOutcome.OpensSoon,
};

const REFUSAL_OF_VERDICT: Record<TurnstileVerdict, JoinOutcome | null> = {
  [TurnstileVerdict.Accepted]: null,
  [TurnstileVerdict.Refused]: JoinOutcome.CheckFailed,
  [TurnstileVerdict.Unavailable]: JoinOutcome.OpensSoon,
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

function outcomeOfRefusal(refusal: WaitlistRefusal | null): JoinOutcome | null {
  if (refusal === null) return null;
  return OUTCOME_OF_REFUSAL[refusal];
}

async function joinOutcomeOf({ request, env, executionContext }: SiteContext): Promise<JoinOutcome> {
  const guard = waitlistGuardOf({ request, env });
  if (guard === null) return JoinOutcome.OpensSoon;
  const clientRefusal = outcomeOfRefusal(await waitlistClientRefusal({ request, env }));
  if (clientRefusal !== null) return clientRefusal;
  const form = await joinFormOf(request);
  if (form === null) return JoinOutcome.Invalid;
  const address = normalizedAddress(form.email);
  if (address === null) return JoinOutcome.Invalid;
  const token = form[TURNSTILE_RESPONSE_FIELD];
  const hasUsableToken = token !== undefined && TURNSTILE_TOKEN_PATTERN.test(token);
  if (!hasUsableToken) return JoinOutcome.CheckFailed;
  const now = Date.now();
  const stampVerdict = await stampVerdictOf({ secret: guard.secret, stamp: form[STAMP_FIELD_NAME], now });
  if (stampVerdict === StampVerdict.Missing) return JoinOutcome.CheckFailed;
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
  const globalRefusal = outcomeOfRefusal(await waitlistGlobalRefusal({ request, env }));
  if (globalRefusal !== null) return globalRefusal;
  const addressRefusal = outcomeOfRefusal(await waitlistAddressRefusal({ request, env, address }));
  if (addressRefusal !== null) return addressRefusal;
  const honeypot = form[HONEYPOT_FIELD_NAME];
  const isHoneypotFilled = honeypot !== undefined && honeypot !== '';
  if (isHoneypotFilled) return JoinOutcome.Joined;
  if (stampVerdict !== StampVerdict.Patient) return JoinOutcome.Joined;
  if (isOwnDomainAddress(address)) return JoinOutcome.Joined;
  const joined = await joinWaitlistWithinLimit({ database: env.DIRECTORY, address, now }).catch(() => null);
  if (joined === null) return JoinOutcome.TryAgain;
  if (joined === WaitlistJoin.Full) return JoinOutcome.OpensSoon;
  if (joined === WaitlistJoin.Known) return JoinOutcome.Joined;
  const confirmation = sendConfirmation({ sender: guard.sender, database: env.DIRECTORY, address, siteOrigin: guard.siteOrigin });
  executionContext.waitUntil(confirmation.catch(() => undefined));
  return JoinOutcome.Joined;
}

function isJsonAccepted(acceptedTypes: string | null): boolean {
  if (acceptedTypes === null) return false;
  return acceptedTypes.split(ACCEPT_SEPARATOR).some((range) => {
    const [mediaType, ...parameters] = range.split(PARAMETER_SEPARATOR).map((part) => part.trim().toLowerCase());
    const quality = parameters.find((parameter) => parameter.startsWith(QUALITY_PREFIX));
    const isRefused = quality !== undefined && Number(quality.slice(QUALITY_PREFIX.length)) === 0;
    return mediaType === MediaType.Json && !isRefused;
  });
}

function jsonAnswer(outcome: JoinOutcome): Response {
  const headers = { [HttpHeader.CacheControl]: NO_STORE, [HttpHeader.ContentTypeOptions]: NO_SNIFF };
  return Response.json({ outcome }, { status: STATUS_OF_OUTCOME[outcome], headers });
}

async function pageAnswer({ outcome, env }: { outcome: JoinOutcome; env: Env }): Promise<Response> {
  const notice = NOTICE_OF_OUTCOME[outcome];
  const page = await serveLandingPage({ notice, challenge: landingChallengeKeysOf(env) });
  return new Response(page.body, { status: STATUS_OF_NOTICE[notice], headers: page.headers });
}

export async function serveWaitlistJoin(context: SiteContext): Promise<Response> {
  const outcome = await joinOutcomeOf(context);
  const wantsJson = isJsonAccepted(context.request.headers.get(HttpHeader.Accept));
  const answer = wantsJson ? jsonAnswer(outcome) : await pageAnswer({ outcome, env: context.env });
  answer.headers.set(HttpHeader.Vary, HttpHeader.Accept);
  if (answer.status === HttpStatus.TooManyRequests) answer.headers.set(HttpHeader.RetryAfter, String(WAITLIST_RATE_LIMIT_PERIOD_SECONDS));
  return answer;
}
