import { MILLISECONDS_PER_SECOND, SIGN_IN_RATE_LIMIT_PERIOD_SECONDS } from '@todz/types';
import { z } from 'zod';
import { digestCredential } from '../credential-digest';
import { CodeTable, CodeVerdict, EMAIL_CODE_PATTERN, spendEmailCode } from '../email-code';
import { normalizedAddress } from '../email-address';
import { HttpHeader, NO_STORE } from '../http-header';
import { HttpStatus } from '../http-status';
import { admittedOwner } from '../owner-sign-in';
import { MediaType, hasMediaType, isBoundedRequest } from '../request-body';
import { isSameOriginRequest } from '../same-origin';
import { codeLimitRefusal } from '../sign-in-limiter';
import { SignInProviderKind } from '../sign-in-provider';
import { canonicalTimeZone } from '../time-zone';
import { CodeState, EMAIL_CODE_FIELD } from '../site/email-code-input';
import {
  OAuthCookie,
  clearedOAuthCookieHeaderOf,
  oauthCookieHeaderOf,
  oauthCookieValueOf,
  openOAuthSession,
} from './oauth-browser-session';
import type { OAuthContext } from './oauth-context';
import { OAuthRefusal, inboxPageOf, refusalPageOf } from './oauth-pages';
import { OAuthField, OAuthPath } from './oauth-paths';
import { linkGuardOf, validRequestOf } from './oauth-sign-in';

const CodeFormSchema = z.object({
  [OAuthField.Email]: z.string(),
  [EMAIL_CODE_FIELD]: z.string(),
  [OAuthField.Request]: z.string(),
  [OAuthField.TimeZone]: z.string(),
});

type CodeForm = z.output<typeof CodeFormSchema>;

async function codeFormOf(request: Request): Promise<CodeForm | null> {
  const isReadableForm = isBoundedRequest({ request }) && hasMediaType({ request, mediaType: MediaType.Form });
  if (!isReadableForm) return null;
  const parsed = CodeFormSchema.safeParse(Object.fromEntries(new URLSearchParams(await request.text())));
  if (!parsed.success) return null;
  return parsed.data;
}

function codePageOf({
  context,
  siteKey,
  form,
  state,
  retryAfterMs,
}: {
  context: OAuthContext;
  siteKey: string;
  form: CodeForm;
  state: CodeState;
  retryAfterMs?: number;
}): Response {
  const answer = inboxPageOf({
    request: context.request,
    cookies: [],
    address: form[OAuthField.Email],
    params: new URLSearchParams(form[OAuthField.Request]),
    siteKey,
    state,
  });
  if (retryAfterMs !== undefined) answer.headers.set(HttpHeader.RetryAfter, String(Math.ceil(retryAfterMs / MILLISECONDS_PER_SECOND)));
  return answer;
}

function redirectAnswerOf({ location, cookies }: { location: string; cookies: string[] }): Response {
  const answer = new Response(null, {
    status: HttpStatus.SeeOther,
    headers: { [HttpHeader.Location]: location, [HttpHeader.CacheControl]: NO_STORE },
  });
  cookies.forEach((cookie) => answer.headers.append(HttpHeader.SetCookie, cookie));
  return answer;
}

// NB ADR 0127: the code spends the link only with the challenge cookie of the browser that asked, then admits the address exactly as the link does; a wrong code answers the same page whether or not the address asked.
export async function serveOAuthCode(context: OAuthContext): Promise<Response> {
  const { request, env, now, issuer, executionContext } = context;
  const guard = linkGuardOf(context);
  if (guard === null) return refusalPageOf({ request, refusal: OAuthRefusal.Unavailable });
  if (!isSameOriginRequest({ request, origin: issuer })) return refusalPageOf({ request, refusal: OAuthRefusal.Forbidden });
  const form = await codeFormOf(request);
  if (form === null) return refusalPageOf({ request, refusal: OAuthRefusal.Invalid });
  const authorization = await validRequestOf({ context, form });
  const address = normalizedAddress(form[OAuthField.Email]);
  if (authorization === null || address === null) return refusalPageOf({ request, refusal: OAuthRefusal.Invalid });
  const pageArguments = { context, siteKey: guard.siteKey, form };
  const limitRefusal = await codeLimitRefusal({ request, env });
  if (limitRefusal !== null && limitRefusal.status === HttpStatus.TooManyRequests)
    return codePageOf({
      ...pageArguments,
      state: CodeState.Locked,
      retryAfterMs: SIGN_IN_RATE_LIMIT_PERIOD_SECONDS * MILLISECONDS_PER_SECOND,
    });
  if (limitRefusal !== null) return refusalPageOf({ request, refusal: OAuthRefusal.Unavailable });
  const challenge = oauthCookieValueOf({ request, cookie: OAuthCookie.Challenge });
  const isPresentedCode = challenge !== null && EMAIL_CODE_PATTERN.test(form[EMAIL_CODE_FIELD]);
  if (!isPresentedCode) return codePageOf({ ...pageArguments, state: CodeState.Wrong });
  const outcome = await spendEmailCode({
    directory: env.DIRECTORY,
    table: CodeTable.SignInLinks,
    email: address,
    challenge: await digestCredential(challenge),
    code: form[EMAIL_CODE_FIELD],
    now,
  });
  if (outcome.verdict === CodeVerdict.Locked)
    return codePageOf({ ...pageArguments, state: CodeState.Locked, retryAfterMs: outcome.retryAfterMs });
  if (outcome.verdict === CodeVerdict.Wrong) return codePageOf({ ...pageArguments, state: CodeState.Wrong });
  const admitted = await admittedOwner({
    request,
    env,
    kind: SignInProviderKind.Email,
    subject: outcome.email,
    timeZone: canonicalTimeZone(form[OAuthField.TimeZone]),
    now,
    executionContext,
  });
  if (admitted instanceof Response) return refusalPageOf({ request, refusal: OAuthRefusal.Unavailable });
  const secret = await openOAuthSession({ directory: env.DIRECTORY, ownerId: admitted.id, now });
  return redirectAnswerOf({
    location: `${OAuthPath.Authorize}?${new URLSearchParams(form[OAuthField.Request])}`,
    cookies: [oauthCookieHeaderOf({ cookie: OAuthCookie.Session, value: secret }), clearedOAuthCookieHeaderOf(OAuthCookie.Challenge)],
  });
}
