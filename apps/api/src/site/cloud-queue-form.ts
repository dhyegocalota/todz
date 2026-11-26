import { SIGN_IN_RATE_LIMIT_PERIOD_SECONDS } from '@todz/types';
import { z } from 'zod';
import { joinQueueWhenFull, QueueJoin } from '../cloud-queue-join';
import { normalizedAddress } from '../email-address';
import type { Env } from '../env';
import { HttpHeader } from '../http-header';
import { HttpStatus } from '../http-status';
import { isLocalSiteHost } from '../local-origin';
import { OwnerRoute } from '../owner-routes';
import { MediaType, hasMediaType, isBoundedRequest } from '../request-body';
import { addressLimitRefusal, globalLimitRefusal, signInLimitRefusal } from '../sign-in-limiter';
import { publicOriginOf } from '../sign-in-links';
import { TURNSTILE_TOKEN_PATTERN, TurnstileAction, TurnstileVerdict, verifyTurnstileToken } from '../turnstile';
import { TURNSTILE_RESPONSE_FIELD, siteKeyOf } from '../turnstile-page';
import { AdminField } from './admin-paths';
import { isSameOriginPost } from './admin-session';
import { CloudQueueNotice, cloudQueuePageResponse } from './cloud-queue-page';
import type { SiteContext } from './site-endpoint';

const QueueFormSchema = z.object({ [AdminField.Email]: z.string(), [TURNSTILE_RESPONSE_FIELD]: z.string() });

const NOTICE_OF_VERDICT: Record<TurnstileVerdict, CloudQueueNotice | null> = {
  [TurnstileVerdict.Accepted]: null,
  [TurnstileVerdict.Refused]: CloudQueueNotice.TryAgain,
  [TurnstileVerdict.Unavailable]: CloudQueueNotice.Closed,
};

function noticeOfRefusal(refusal: Response | null): CloudQueueNotice | null {
  if (refusal === null) return null;
  if (refusal.status === HttpStatus.TooManyRequests) return CloudQueueNotice.TryAgain;
  return CloudQueueNotice.Closed;
}

async function queueFormOf(request: Request): Promise<z.output<typeof QueueFormSchema> | null> {
  const isReadableForm = isBoundedRequest({ request }) && hasMediaType({ request, mediaType: MediaType.Form });
  if (!isReadableForm) return null;
  const parsed = QueueFormSchema.safeParse(Object.fromEntries(new URLSearchParams(await request.text())));
  if (!parsed.success) return null;
  return parsed.data;
}

function isGuarded({ env }: { env: Env }): boolean {
  const isConfigured = publicOriginOf(env.SITE_ORIGIN) !== null && env.TURNSTILE_SECRET_KEY !== undefined;
  return isConfigured && siteKeyOf(env) !== null;
}

// NB ADR 0099: the line is a public form on the site host with its own Turnstile action; it joins the same limiters and the same queue as the owner route.
async function queueNoticeOf({ request, env }: { request: Request; env: Env }): Promise<CloudQueueNotice> {
  const { TURNSTILE_SECRET_KEY: secret } = env;
  const siteOrigin = publicOriginOf(env.SITE_ORIGIN);
  if (siteOrigin === null || secret === undefined || siteKeyOf(env) === null) return CloudQueueNotice.Closed;
  if (!isSameOriginPost({ request, env })) return CloudQueueNotice.Forbidden;
  const clientRefusal = noticeOfRefusal(await signInLimitRefusal({ request, env, route: OwnerRoute.JoinCloudQueue }));
  if (clientRefusal !== null) return clientRefusal;
  const form = await queueFormOf(request);
  if (form === null) return CloudQueueNotice.TryAgain;
  const address = normalizedAddress(form[AdminField.Email]);
  const token = form[TURNSTILE_RESPONSE_FIELD];
  if (address === null || !TURNSTILE_TOKEN_PATTERN.test(token)) return CloudQueueNotice.TryAgain;
  const verdict = await verifyTurnstileToken({
    token,
    secret,
    hostname: new URL(siteOrigin).hostname,
    action: TurnstileAction.CloudQueue,
    isLocalHost: isLocalSiteHost({ env, request }),
    fetcher: fetch,
  });
  const challengeRefusal = NOTICE_OF_VERDICT[verdict];
  if (challengeRefusal !== null) return challengeRefusal;
  const globalRefusal = noticeOfRefusal(await globalLimitRefusal({ request, env, route: OwnerRoute.JoinCloudQueue }));
  if (globalRefusal !== null) return globalRefusal;
  const addressRefusal = noticeOfRefusal(await addressLimitRefusal({ request, env, address }));
  if (addressRefusal !== null) return addressRefusal;
  const join = await joinQueueWhenFull({ env, address, now: Date.now() });
  if (join === QueueJoin.Refused) return CloudQueueNotice.TryAgain;
  return CloudQueueNotice.Queued;
}

export function serveCloudQueuePage({ env }: SiteContext): Response {
  if (!isGuarded({ env })) return cloudQueuePageResponse({ notice: CloudQueueNotice.Closed, siteKey: null });
  return cloudQueuePageResponse({ notice: CloudQueueNotice.None, siteKey: siteKeyOf(env) });
}

export async function serveCloudQueueJoin({ request, env }: SiteContext): Promise<Response> {
  const notice = await queueNoticeOf({ request, env });
  const response = cloudQueuePageResponse({ notice, siteKey: siteKeyOf(env) });
  if (response.status === HttpStatus.TooManyRequests)
    response.headers.set(HttpHeader.RetryAfter, String(SIGN_IN_RATE_LIMIT_PERIOD_SECONDS));
  return response;
}
