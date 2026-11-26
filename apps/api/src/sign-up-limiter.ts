import { FairUseLimit } from '@todz/types';
import { clientRateKey } from './client-rate-key';
import { digestCredential } from './credential-digest';
import { findIdentityOwner } from './directory-owners';
import { isDisposableEmailAddress } from './disposable-email-domains';
import type { Env } from './env';
import { fairUseLimitsOf } from './fair-use-limits';
import { HttpHeader } from './http-header';
import { isLocalHost } from './local-origin';
import { OwnerErrorCode, errorResponse, limitResponse, signUpRefusedResponse } from './owner-errors';
import { reserveSignUp } from './owner-usage-store';
import { SignInProviderKind } from './sign-in-provider';
import { utcDayOf } from './telemetry/telemetry-day';

export async function signUpRefusalOf({
  request,
  env,
  kind,
  subject,
  now,
}: {
  request: Request;
  env: Env;
  kind: SignInProviderKind;
  subject: string;
  now: number;
}): Promise<Response | null> {
  const knownOwnerId = await findIdentityOwner({ directory: env.DIRECTORY, provider: kind, subject });
  if (knownOwnerId !== null) return null;
  if (kind === SignInProviderKind.Email && isDisposableEmailAddress(subject)) return signUpRefusedResponse();
  if (isLocalHost({ env, request })) return null;
  const clientAddress = request.headers.get(HttpHeader.ClientAddress);
  if (clientAddress === null) return errorResponse(OwnerErrorCode.SignInUnavailable);
  const limits = fairUseLimitsOf(env);
  const clientKey = await digestCredential(clientRateKey({ address: clientAddress }));
  const reservation = await reserveSignUp({
    directory: env.DIRECTORY,
    clientKey,
    day: utcDayOf(now),
    limit: limits[FairUseLimit.DailySignUps],
  }).catch(() => null);
  if (reservation === null) return errorResponse(OwnerErrorCode.SignInUnavailable);
  if (!reservation) return limitResponse({ limit: FairUseLimit.DailySignUps, limits, now });
  return null;
}
