import { SIGN_IN_RATE_LIMIT_PERIOD_SECONDS } from '@todz/types';
import { z } from 'zod';
import { cloudQueueAddressOf, queueSecretOf } from '../cloud-queue-token';
import { joinQueue, QueueJoin } from '../cloud-queue-join';
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
import { isSameOriginPost } from './admin-session';
import { type CloudQueueForm, CloudQueueNotice, cloudQueuePageResponse, maskedAddressOf } from './cloud-queue-page';
import type { SiteContext } from './site-endpoint';
import { CLOUD_QUEUE_TOKEN_FIELD } from './site-urls';

const QUEUE_ROUTE = OwnerRoute.RequestSignInLink;

const QueueFormSchema = z.object({ [CLOUD_QUEUE_TOKEN_FIELD]: z.string(), [TURNSTILE_RESPONSE_FIELD]: z.string() });

const NOTICE_OF_VERDICT: Record<TurnstileVerdict, CloudQueueNotice | null> = {
  [TurnstileVerdict.Accepted]: null,
  [TurnstileVerdict.Refused]: CloudQueueNotice.TryAgain,
  [TurnstileVerdict.Unavailable]: CloudQueueNotice.Closed,
};

type QueueAnswer = { notice: CloudQueueNotice; token: string | null; address: string | null };

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
  const isConfigured = publicOriginOf(env.SITE_ORIGIN) !== null && env.TURNSTILE_SECRET_KEY !== undefined && queueSecretOf(env) !== null;
  return isConfigured && siteKeyOf(env) !== null;
}

function answerOf({ notice, token }: { notice: CloudQueueNotice; token: string | null }): QueueAnswer {
  return { notice, token, address: null };
}

// NB ADR 0099: only the holder of the signed link in the full mail joins the line, so a typed address never does; it uses the sign-in limiters and its own Turnstile action on the site host.
async function queueAnswerOf({ request, env }: { request: Request; env: Env }): Promise<QueueAnswer> {
  const { TURNSTILE_SECRET_KEY: secret } = env;
  const siteOrigin = publicOriginOf(env.SITE_ORIGIN);
  const keySecret = queueSecretOf(env);
  if (siteOrigin === null || secret === undefined || keySecret === null || siteKeyOf(env) === null) {
    return answerOf({ notice: CloudQueueNotice.Closed, token: null });
  }
  if (!isSameOriginPost({ request, env })) return answerOf({ notice: CloudQueueNotice.Forbidden, token: null });
  const clientRefusal = noticeOfRefusal(await signInLimitRefusal({ request, env, route: QUEUE_ROUTE }));
  if (clientRefusal !== null) return answerOf({ notice: clientRefusal, token: null });
  const form = await queueFormOf(request);
  if (form === null) return answerOf({ notice: CloudQueueNotice.Invalid, token: null });
  const token = form[CLOUD_QUEUE_TOKEN_FIELD];
  const address = await cloudQueueAddressOf({ secret: keySecret, token, now: Date.now() });
  if (address === null) return answerOf({ notice: CloudQueueNotice.Invalid, token: null });
  const solved = form[TURNSTILE_RESPONSE_FIELD];
  if (!TURNSTILE_TOKEN_PATTERN.test(solved)) return { notice: CloudQueueNotice.TryAgain, token, address };
  const verdict = await verifyTurnstileToken({
    token: solved,
    secret,
    hostname: new URL(siteOrigin).hostname,
    action: TurnstileAction.CloudQueue,
    isLocalHost: isLocalSiteHost({ env, request }),
    fetcher: fetch,
  });
  const challengeRefusal = NOTICE_OF_VERDICT[verdict];
  if (challengeRefusal !== null) return { notice: challengeRefusal, token, address };
  const globalRefusal = noticeOfRefusal(await globalLimitRefusal({ request, env, route: QUEUE_ROUTE }));
  if (globalRefusal !== null) return { notice: globalRefusal, token, address };
  const addressRefusal = noticeOfRefusal(await addressLimitRefusal({ request, env, address }));
  if (addressRefusal !== null) return { notice: addressRefusal, token, address };
  const join = await joinQueue({ env, address, now: Date.now() });
  if (join === QueueJoin.Refused) return { notice: CloudQueueNotice.TryAgain, token, address };
  return { notice: CloudQueueNotice.Queued, token, address };
}

function formOf({ token, address }: { token: string | null; address: string | null }): CloudQueueForm | null {
  if (token === null || address === null) return null;
  return { token, maskedAddress: maskedAddressOf(address) };
}

export async function serveCloudQueuePage({ request, env }: SiteContext): Promise<Response> {
  const siteKey = siteKeyOf(env);
  if (!isGuarded({ env })) return cloudQueuePageResponse({ notice: CloudQueueNotice.Closed, siteKey, form: null });
  const keySecret = queueSecretOf(env);
  const token = new URL(request.url).searchParams.get(CLOUD_QUEUE_TOKEN_FIELD);
  if (keySecret === null || token === null) return cloudQueuePageResponse({ notice: CloudQueueNotice.Invalid, siteKey, form: null });
  const address = await cloudQueueAddressOf({ secret: keySecret, token, now: Date.now() });
  if (address === null) return cloudQueuePageResponse({ notice: CloudQueueNotice.Invalid, siteKey, form: null });
  return cloudQueuePageResponse({ notice: CloudQueueNotice.None, siteKey, form: formOf({ token, address }) });
}

export async function serveCloudQueueJoin({ request, env }: SiteContext): Promise<Response> {
  const answer = await queueAnswerOf({ request, env });
  const response = cloudQueuePageResponse({ notice: answer.notice, siteKey: siteKeyOf(env), form: formOf(answer) });
  if (response.status === HttpStatus.TooManyRequests)
    response.headers.set(HttpHeader.RetryAfter, String(SIGN_IN_RATE_LIMIT_PERIOD_SECONDS));
  return response;
}
