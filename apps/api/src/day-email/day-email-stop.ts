import { DAY_EMAIL_STOP_RATE_LIMIT_PERIOD_SECONDS, DAY_EMAIL_STOP_TOKEN_LENGTH } from '@todz/types';
import { clientRateKey } from '../client-rate-key';
import { digestCredential } from '../credential-digest';
import type { Env } from '../env';
import { HttpHeader } from '../http-header';
import { HttpMethod } from '../http-method';
import { HttpStatus } from '../http-status';
import { LimitRefusal, limitRefusal } from '../limit-refusal';
import { isLocalHost } from '../local-origin';
import { stopDayEmail, stopLinkLanguage } from './day-email-store';
import { StopPageKind, stopPageResponse } from './day-email-stop-page';
import { DAY_EMAIL_STOP_PATH, DAY_EMAIL_STOP_TOKEN_PARAMETER } from './day-email-stop-url';

type StopContext = { request: Request; env: Env };

type TokenContext = StopContext & { digest: string; now: number };

type TokenHandler = (context: TokenContext) => Promise<Response>;

const TOKEN_PATTERN = new RegExp(`^[0-9a-f]{${DAY_EMAIL_STOP_TOKEN_LENGTH}}$`);
const ALLOWED_METHODS = [HttpMethod.Get, HttpMethod.Post].join(', ');

const ANSWER_OF_LIMIT_REFUSAL: Record<LimitRefusal, (request: Request) => Response> = {
  [LimitRefusal.TryAgain]: (request) =>
    stopPageResponse({
      request,
      kind: StopPageKind.Limited,
      status: HttpStatus.TooManyRequests,
      headers: { [HttpHeader.RetryAfter]: String(DAY_EMAIL_STOP_RATE_LIMIT_PERIOD_SECONDS) },
    }),
  [LimitRefusal.Unavailable]: (request) => stopPageResponse({ request, kind: StopPageKind.Limited, status: HttpStatus.Unavailable }),
};

function goneResponse(request: Request): Response {
  return stopPageResponse({ request, kind: StopPageKind.Gone, status: HttpStatus.NotFound });
}

function tokenOf(request: Request): string | null {
  const [token, ...rest] = new URL(request.url).searchParams.getAll(DAY_EMAIL_STOP_TOKEN_PARAMETER);
  const isSingleWellFormedToken = token !== undefined && rest.length === 0 && TOKEN_PATTERN.test(token);
  if (!isSingleWellFormedToken) return null;
  return token;
}

// NB ADR 0045: on a public host the stop link fails closed without its limiter or the client address, and only a local host skips them.
async function limitedResponse({ request, env }: StopContext): Promise<Response | null> {
  if (isLocalHost({ env, request })) return null;
  const clientAddress = request.headers.get(HttpHeader.ClientAddress);
  if (clientAddress === null) return ANSWER_OF_LIMIT_REFUSAL[LimitRefusal.Unavailable](request);
  const key = `${DAY_EMAIL_STOP_PATH}:${clientRateKey({ address: clientAddress })}`;
  const refusal = await limitRefusal({ limiter: env.DAY_EMAIL_STOP_LIMITER, key });
  if (refusal === null) return null;
  return ANSWER_OF_LIMIT_REFUSAL[refusal](request);
}

async function confirmPage({ request, env, digest, now }: TokenContext): Promise<Response> {
  const ownerLanguage = await stopLinkLanguage({ directory: env.DIRECTORY, digest, now });
  if (ownerLanguage === null) return goneResponse(request);
  return stopPageResponse({ request, kind: StopPageKind.Confirm, status: HttpStatus.Ok, ownerLanguage });
}

async function stopMail({ request, env, digest, now }: TokenContext): Promise<Response> {
  const ownerLanguage = await stopLinkLanguage({ directory: env.DIRECTORY, digest, now });
  if (!(await stopDayEmail({ directory: env.DIRECTORY, digest, now }))) return goneResponse(request);
  return stopPageResponse({ request, kind: StopPageKind.Done, status: HttpStatus.Ok, ownerLanguage });
}

const HANDLER_OF_METHOD: Record<string, TokenHandler> = {
  [HttpMethod.Get]: confirmPage,
  [HttpMethod.Post]: stopMail,
};

export async function dayEmailStopResponse({ request, env }: StopContext): Promise<Response> {
  const handler = HANDLER_OF_METHOD[request.method];
  if (handler === undefined)
    return new Response(null, { status: HttpStatus.MethodNotAllowed, headers: { [HttpHeader.Allow]: ALLOWED_METHODS } });
  const limited = await limitedResponse({ request, env });
  if (limited !== null) return limited;
  const token = tokenOf(request);
  if (token === null) return goneResponse(request);
  return handler({ request, env, digest: await digestCredential(token), now: Date.now() });
}
