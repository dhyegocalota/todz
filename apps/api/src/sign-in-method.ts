import { OwnerErrorCode, errorResponse } from './owner-errors';
import type { OwnerContext } from './owner-request';
import { SIGN_IN_PROVIDER_OF_KIND, signInKindForRequest } from './sign-in-provider';

export async function readSignInMethod({ env, request }: OwnerContext): Promise<Response> {
  const kind = signInKindForRequest({ env, request });
  if (kind === null) return errorResponse(OwnerErrorCode.SignInUnavailable);
  return Response.json({ method: SIGN_IN_PROVIDER_OF_KIND[kind].method });
}
