import { z } from 'zod';
import { isCloudFullFor } from './cloud-admission';
import { CLOUD_COPY } from './cloud-copy';
import { enqueueAddress } from './cloud-queue-store';
import { isDisposableEmailAddress } from './disposable-email-domains';
import { isOwnDomainAddress, normalizedAddress } from './email-address';
import { HttpStatus } from './http-status';
import { OwnerErrorCode, errorResponse, signUpRefusedResponse } from './owner-errors';
import { type OwnerContext, parsedPublicBody } from './owner-request';
import { OwnerRoute } from './owner-routes';
import { signInChallengeOf } from './sign-in-challenge';
import { addressLimitRefusal, globalLimitRefusal } from './sign-in-limiter';
import { TurnstileAction } from './turnstile';

const RequestBodySchema = z.object({
  email: z.string(),
  turnstile_token: z.string(),
});

export async function joinCloudQueue({ request, env, now }: OwnerContext): Promise<Response> {
  const challenge = signInChallengeOf({ request, env, action: TurnstileAction.RequestLink });
  if (challenge === null) return errorResponse(OwnerErrorCode.SignInUnavailable);
  const body = await parsedPublicBody({ request, schema: RequestBodySchema });
  if (body === null) return errorResponse(OwnerErrorCode.InvalidRequest);
  const address = normalizedAddress(body.email);
  if (address === null) return errorResponse(OwnerErrorCode.InvalidRequest);
  const challengeRefusal = await challenge.refusalOf(body.turnstile_token);
  if (challengeRefusal !== null) return challengeRefusal;
  const globalRefusal = await globalLimitRefusal({ request, env, route: OwnerRoute.JoinCloudQueue });
  if (globalRefusal !== null) return globalRefusal;
  const addressRefusal = await addressLimitRefusal({ request, env, address });
  if (addressRefusal !== null) return addressRefusal;
  if (isDisposableEmailAddress(address)) return signUpRefusedResponse();
  const isWaiting = !isOwnDomainAddress(address) && (await isCloudFullFor({ env, address, now }));
  if (isWaiting) await enqueueAddress({ directory: env.DIRECTORY, email: address, now });
  return Response.json({ message: CLOUD_COPY.queued }, { status: HttpStatus.Accepted });
}
