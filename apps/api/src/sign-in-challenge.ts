import type { Env } from './env';
import { isLocalHost } from './local-origin';
import { OwnerErrorCode, errorResponse } from './owner-errors';
import { signInRefusal } from './sign-in-limiter';
import { publicOriginOf } from './sign-in-links';
import { TURNSTILE_TOKEN_PATTERN, type TurnstileAction, TurnstileVerdict, verifyTurnstileToken } from './turnstile';

export type SignInChallenge = { refusalOf(token: string | undefined): Promise<Response | null> };

const REFUSAL_OF_VERDICT: Record<TurnstileVerdict, () => Response | null> = {
  [TurnstileVerdict.Accepted]: () => null,
  [TurnstileVerdict.Refused]: signInRefusal,
  [TurnstileVerdict.Unavailable]: () => errorResponse(OwnerErrorCode.SignInUnavailable),
};

export function signInChallengeOf({
  request,
  env,
  action,
}: {
  request: Request;
  env: Env;
  action: TurnstileAction;
}): SignInChallenge | null {
  const publicOrigin = publicOriginOf(env.PUBLIC_ORIGIN);
  const { TURNSTILE_SECRET_KEY: secret } = env;
  if (publicOrigin === null) return null;
  if (secret === undefined) return null;
  const hostname = new URL(publicOrigin).hostname;
  return {
    async refusalOf(token) {
      const isWellFormed = token !== undefined && TURNSTILE_TOKEN_PATTERN.test(token);
      if (!isWellFormed) return errorResponse(OwnerErrorCode.InvalidRequest);
      const verdict = await verifyTurnstileToken({
        token,
        secret,
        hostname,
        action,
        isLocalHost: isLocalHost({ env, request }),
        fetcher: fetch,
      });
      return REFUSAL_OF_VERDICT[verdict]();
    },
  };
}
