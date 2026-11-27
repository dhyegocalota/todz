import { z } from 'zod';
import { mailMeterOf } from '../cloud-mail-meter';
import { digestCredential } from '../credential-digest';
import { generateCredentialSecret } from '../credential-secret';
import { normalizedAddress } from '../email-address';
import { type EmailSender, emailSenderOf } from '../email-sender';
import { oauthSignInMail } from '../emails/oauth-sign-in-mail';
import { HttpHeader } from '../http-header';
import { HttpStatus } from '../http-status';
import { OwnerErrorCode, errorResponse } from '../owner-errors';
import { parsedPublicBody } from '../owner-request';
import { OwnerRoute } from '../owner-routes';
import { languageOfRequest } from '../page-preferences';
import { admittedOwner } from '../owner-sign-in';
import { MediaType, hasMediaType, isBoundedRequest } from '../request-body';
import { isSameOriginRequest } from '../same-origin';
import { signInChallengeOf } from '../sign-in-challenge';
import { addressLimitRefusal, globalLimitRefusal, signInLimitRefusal } from '../sign-in-limiter';
import { LinkMailing, mailSignInLink } from '../sign-in-links';
import { SIGN_IN_PROVIDER_OF_KIND, SignInProviderKind, signInKindOf } from '../sign-in-provider';
import { canonicalTimeZone } from '../time-zone';
import { TurnstileAction } from '../turnstile';
import { TURNSTILE_RESPONSE_FIELD, siteKeyOf } from '../turnstile-page';
import { AuthorizationOutcomeKind, type AuthorizationRequest, authorizationOutcomeOf } from './oauth-authorization-request';
import {
  OAuthCookie,
  clearedOAuthCookieHeaderOf,
  oauthCookieHeaderOf,
  oauthCookieValueOf,
  openOAuthSession,
} from './oauth-browser-session';
import type { OAuthContext } from './oauth-context';
import { OAuthNotice, OAuthRefusal, inboxPageOf, refusalPageOf, signInPageOf } from './oauth-pages';
import { OAuthField, OAuthPath } from './oauth-paths';

const LINK_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const LinkFormSchema = z.object({
  [OAuthField.Email]: z.string(),
  [TURNSTILE_RESPONSE_FIELD]: z.string(),
  [OAuthField.Request]: z.string(),
});

const SessionBodySchema = z.object({ [OAuthField.Token]: z.string(), [OAuthField.TimeZone]: z.string() });

type LinkForm = z.output<typeof LinkFormSchema>;

type LinkGuard = { siteKey: string; sender: EmailSender };

const RETRYABLE_STATUSES: number[] = [HttpStatus.BadRequest, HttpStatus.TooManyRequests];

function isEmailSignIn(context: OAuthContext): boolean {
  return signInKindOf(context.env.SIGN_IN_PROVIDER) === SignInProviderKind.Email;
}

// NB ADR 0109: OAuth sign-in is the owner's email link and nothing else; without the email provider, a site key and a sender it is unavailable.
export function linkGuardOf(context: OAuthContext): LinkGuard | null {
  const { request, env, issuer } = context;
  const siteKey = siteKeyOf(env);
  if (!isEmailSignIn(context)) return null;
  if (siteKey === null) return null;
  const sender = emailSenderOf({
    configured: env.EMAIL_SENDER,
    publicOrigin: issuer,
    requestUrl: request.url,
    binding: env.EMAIL,
    meter: mailMeterOf(env),
  });
  if (sender === null) return null;
  return { siteKey, sender };
}

async function linkFormOf(request: Request): Promise<LinkForm | null> {
  const isReadableForm = isBoundedRequest({ request }) && hasMediaType({ request, mediaType: MediaType.Form });
  if (!isReadableForm) return null;
  const parsed = LinkFormSchema.safeParse(Object.fromEntries(new URLSearchParams(await request.text())));
  if (!parsed.success) return null;
  return parsed.data;
}

async function validRequestOf({ context, form }: { context: OAuthContext; form: LinkForm }): Promise<AuthorizationRequest | null> {
  const outcome = await authorizationOutcomeOf({
    params: new URLSearchParams(form[OAuthField.Request]),
    env: context.env,
    issuer: context.issuer,
    now: context.now,
  });
  if (outcome.kind !== AuthorizationOutcomeKind.Valid) return null;
  return outcome.request;
}

async function refusalOfAsk({
  context,
  address,
  turnstileToken,
}: {
  context: OAuthContext;
  address: string;
  turnstileToken: string;
}): Promise<Response | null> {
  const { request, env } = context;
  const clientRefusal = await signInLimitRefusal({ request, env, route: OwnerRoute.RequestSignInLink });
  if (clientRefusal !== null) return clientRefusal;
  const challenge = signInChallengeOf({ request, env, action: TurnstileAction.RequestLink });
  if (challenge === null) return errorResponse(OwnerErrorCode.SignInUnavailable);
  const challengeRefusal = await challenge.refusalOf(turnstileToken);
  if (challengeRefusal !== null) return challengeRefusal;
  const globalRefusal = await globalLimitRefusal({ request, env, route: OwnerRoute.RequestSignInLink });
  if (globalRefusal !== null) return globalRefusal;
  return addressLimitRefusal({ request, env, address });
}

// NB ADR 0109: the email form goes through the app sign-in's Turnstile, limiters and mail budget, and mails a link back to this very request.
export async function serveOAuthSignInLink(context: OAuthContext): Promise<Response> {
  const { request, env, now, issuer } = context;
  const guard = linkGuardOf(context);
  if (guard === null) return refusalPageOf({ request, refusal: OAuthRefusal.Unavailable });
  if (!isSameOriginRequest({ request, origin: issuer })) return refusalPageOf({ request, refusal: OAuthRefusal.Forbidden });
  const form = await linkFormOf(request);
  if (form === null) return refusalPageOf({ request, refusal: OAuthRefusal.Invalid });
  const authorization = await validRequestOf({ context, form });
  if (authorization === null) return refusalPageOf({ request, refusal: OAuthRefusal.Invalid });
  const params = authorization.params;
  const clientName = authorization.client.name;
  const address = normalizedAddress(form[OAuthField.Email]);
  if (address === null) return signInPageOf({ request, clientName, params, notice: OAuthNotice.InvalidAddress, siteKey: guard.siteKey });
  const askRefusal = await refusalOfAsk({ context, address, turnstileToken: form[TURNSTILE_RESPONSE_FIELD] });
  if (askRefusal !== null) return answerOfRefusal({ request, refusal: askRefusal, clientName, params, siteKey: guard.siteKey });
  const challenge = generateCredentialSecret();
  const linkOf = (token: string) =>
    `${issuer}${OAuthPath.LinkPage}#${OAuthField.Token}=${token}&${OAuthField.Request}=${encodeURIComponent(params.toString())}`;
  const language = languageOfRequest({ request });
  const mailing = await mailSignInLink({
    env,
    sender: guard.sender,
    address,
    challenge: await digestCredential(challenge),
    now,
    language,
    mailOf: ({ token, code }) => oauthSignInMail({ to: address, link: linkOf(token), code, origin: issuer, language }),
  });
  if (mailing === LinkMailing.Unavailable) return refusalPageOf({ request, refusal: OAuthRefusal.Unavailable });
  if (mailing === LinkMailing.Refused)
    return signInPageOf({ request, clientName, params, notice: OAuthNotice.TryAgain, siteKey: guard.siteKey });
  return inboxPageOf({ request, cookies: [oauthCookieHeaderOf({ cookie: OAuthCookie.Challenge, value: challenge })] });
}

function answerOfRefusal({
  request,
  refusal,
  clientName,
  params,
  siteKey,
}: {
  request: Request;
  refusal: Response;
  clientName: string;
  params: URLSearchParams;
  siteKey: string;
}): Response {
  if (!RETRYABLE_STATUSES.includes(refusal.status)) return refusalPageOf({ request, refusal: OAuthRefusal.Unavailable });
  return signInPageOf({ request, clientName, params, notice: OAuthNotice.TryAgain, siteKey });
}

async function spentSubjectOf({
  context,
  token,
  challenge,
}: {
  context: OAuthContext;
  token: string;
  challenge: string;
}): Promise<string | null> {
  return SIGN_IN_PROVIDER_OF_KIND[SignInProviderKind.Email].verify({
    identityToken: token,
    linkVerifier: challenge,
    directory: context.env.DIRECTORY,
    now: context.now,
  });
}

// NB ADR 0109: the link spends only with the challenge cookie of the browser that asked, then admits the address exactly as the app sign-in does.
export async function serveOAuthSession(context: OAuthContext): Promise<Response> {
  const { request, env, now, issuer, executionContext } = context;
  if (!isEmailSignIn(context)) return errorResponse(OwnerErrorCode.SignInUnavailable);
  if (!isSameOriginRequest({ request, origin: issuer })) return errorResponse(OwnerErrorCode.InvalidRequest);
  const limitRefusal = await signInLimitRefusal({ request, env, route: OwnerRoute.SignIn });
  if (limitRefusal !== null) return limitRefusal;
  const body = await parsedPublicBody({ request, schema: SessionBodySchema });
  if (body === null) return errorResponse(OwnerErrorCode.InvalidRequest);
  const token = body[OAuthField.Token];
  const timeZone = canonicalTimeZone(body[OAuthField.TimeZone]);
  const challenge = oauthCookieValueOf({ request, cookie: OAuthCookie.Challenge });
  if (timeZone === null) return errorResponse(OwnerErrorCode.TimeZoneInvalid);
  const isPresentedLink = challenge !== null && LINK_TOKEN_PATTERN.test(token);
  if (!isPresentedLink) return errorResponse(OwnerErrorCode.IdentityRejected);
  const globalRefusal = await globalLimitRefusal({ request, env, route: OwnerRoute.SignIn });
  if (globalRefusal !== null) return globalRefusal;
  const subject = await spentSubjectOf({ context, token, challenge });
  if (subject === null) return errorResponse(OwnerErrorCode.IdentityRejected);
  const admitted = await admittedOwner({ request, env, kind: SignInProviderKind.Email, subject, timeZone, now, executionContext });
  if (admitted instanceof Response) return admitted;
  const secret = await openOAuthSession({ directory: env.DIRECTORY, ownerId: admitted.id, now });
  const answer = Response.json({}, { status: HttpStatus.Created });
  answer.headers.append(HttpHeader.SetCookie, oauthCookieHeaderOf({ cookie: OAuthCookie.Session, value: secret }));
  answer.headers.append(HttpHeader.SetCookie, clearedOAuthCookieHeaderOf(OAuthCookie.Challenge));
  return answer;
}
