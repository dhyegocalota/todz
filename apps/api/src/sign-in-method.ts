import { OwnerErrorCode, errorResponse } from './owner-errors';
import type { OwnerContext } from './owner-request';
import { SIGN_IN_PROVIDER_OF_KIND, signInKindOf } from './sign-in-provider';

export async function readSignInMethod({ env }: OwnerContext): Promise<Response> {
  const kind = signInKindOf(env.SIGN_IN_PROVIDER);
  if (kind === null) return errorResponse(OwnerErrorCode.SignInUnavailable);
  return Response.json({ method: SIGN_IN_PROVIDER_OF_KIND[kind].method });
}
