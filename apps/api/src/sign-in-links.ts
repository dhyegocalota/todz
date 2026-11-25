import { MILLISECONDS_PER_MINUTE } from '@todz/types';
import { z } from 'zod';
import { digestCredential } from './credential-digest';
import { AppLinkScheme } from './app-link-scheme';
import { generateCredentialSecret } from './credential-secret';
import { deleteSignInLink, insertSignInLinkWithinLimit } from './directory-sign-in-links';
import { isOwnDomainAddress, normalizedAddress } from './email-address';
import { signInMail } from './emails/sign-in-mail';
import { emailSenderOf } from './email-sender';
import { enumValueOf } from './enum-value';
import { isLocalOrigin } from './local-origin';
import { HttpStatus } from './http-status';
import { OwnerErrorCode, errorResponse } from './owner-errors';
import { type OwnerContext, parsedPublicBody } from './owner-request';
import { OwnerRoute } from './owner-routes';
import { signInChallengeOf } from './sign-in-challenge';
import { addressLimitRefusal, globalLimitRefusal, signInRefusal } from './sign-in-limiter';
import { SIGN_IN_PAGE_PATH } from './sign-in-page';
import { SignInProviderKind, signInKindOf } from './sign-in-provider';
import { TurnstileAction } from './turnstile';

const SIGN_IN_LINK_LIFETIME_MINUTES = 15;
const SIGN_IN_LINK_LIFETIME_MS = SIGN_IN_LINK_LIFETIME_MINUTES * MILLISECONDS_PER_MINUTE;
const SIGN_IN_LINKS_PER_ADDRESS_MAX = 5;
const SECURE_PROTOCOL = 'https:';
const PLAIN_PROTOCOL = 'http:';
const LINK_CHALLENGE_PATTERN = /^[0-9a-f]{64}$/;

const RequestBodySchema = z.object({
  email: z.string(),
  link_challenge: z.string(),
  turnstile_token: z.string(),
  app_link_scheme: z.string(),
});

export function publicOriginOf(configured: string | undefined): string | null {
  if (configured === undefined) return null;
  if (!URL.canParse(configured)) return null;
  const { origin, protocol } = new URL(configured);
  if (origin !== configured) return null;
  const isSecure = protocol === SECURE_PROTOCOL;
  const isPlainOnLocalHost = protocol === PLAIN_PROTOCOL && isLocalOrigin(configured);
  if (!isSecure && !isPlainOnLocalHost) return null;
  return configured;
}

// NB ADR 0040: a link lasts 15 minutes, an address gets five in that window, and one statement counts and inserts.
export async function requestSignInLink({ request, env, now }: OwnerContext): Promise<Response> {
  const publicOrigin = publicOriginOf(env.PUBLIC_ORIGIN);
  const isEmailProvider = signInKindOf(env.SIGN_IN_PROVIDER) === SignInProviderKind.Email;
  const isLinkUnsendable = !isEmailProvider || publicOrigin === null;
  if (isLinkUnsendable) return errorResponse(OwnerErrorCode.SignInUnavailable);
  const sender = emailSenderOf({ configured: env.EMAIL_SENDER, publicOrigin, requestUrl: request.url, binding: env.EMAIL });
  if (sender === null) return errorResponse(OwnerErrorCode.SignInUnavailable);
  const challenge = signInChallengeOf({ request, env, action: TurnstileAction.RequestLink });
  if (challenge === null) return errorResponse(OwnerErrorCode.SignInUnavailable);
  const body = await parsedPublicBody({ request, schema: RequestBodySchema });
  if (body === null) return errorResponse(OwnerErrorCode.InvalidRequest);
  const address = normalizedAddress(body.email);
  const appLinkScheme = enumValueOf({ enumeration: AppLinkScheme, candidate: body.app_link_scheme });
  const isMalformedAsk = address === null || appLinkScheme === null || !LINK_CHALLENGE_PATTERN.test(body.link_challenge);
  if (isMalformedAsk) return errorResponse(OwnerErrorCode.InvalidRequest);
  const challengeRefusal = await challenge.refusalOf(body.turnstile_token);
  if (challengeRefusal !== null) return challengeRefusal;
  const globalRefusal = await globalLimitRefusal({ request, env, route: OwnerRoute.RequestSignInLink });
  if (globalRefusal !== null) return globalRefusal;
  const addressRefusal = await addressLimitRefusal({ request, env, address });
  if (addressRefusal !== null) return addressRefusal;
  if (isOwnDomainAddress(address)) return Response.json({}, { status: HttpStatus.Accepted });
  const token = generateCredentialSecret();
  const digest = await digestCredential(token);
  const isWithinLimit = await insertSignInLinkWithinLimit({
    directory: env.DIRECTORY,
    digest,
    email: address,
    challenge: body.link_challenge,
    now,
    expiresAt: now + SIGN_IN_LINK_LIFETIME_MS,
    windowStart: now - SIGN_IN_LINK_LIFETIME_MS,
    linksPerWindowMax: SIGN_IN_LINKS_PER_ADDRESS_MAX,
  });
  if (!isWithinLimit) return signInRefusal();
  try {
    await sender.send(
      signInMail({ to: address, link: `${publicOrigin}${SIGN_IN_PAGE_PATH}#token=${token}&app=${appLinkScheme}`, origin: publicOrigin }),
    );
  } catch {
    await deleteSignInLink({ directory: env.DIRECTORY, digest });
    return errorResponse(OwnerErrorCode.SignInUnavailable);
  }
  return Response.json({}, { status: HttpStatus.Accepted });
}
