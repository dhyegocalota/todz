import { MILLISECONDS_PER_SECOND } from '@todz/types';
import { z } from 'zod';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const SITEVERIFY_TIMEOUT_MS = 5 * MILLISECONDS_PER_SECOND;
const OWN_FAULT_CODES = ['missing-input-secret', 'invalid-input-secret', 'internal-error'];
export const TURNSTILE_DUMMY_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';
export const TURNSTILE_TOKEN_PATTERN_SOURCE = '^[A-Za-z0-9._-]{1,2048}$';
export const TURNSTILE_TOKEN_PATTERN = new RegExp(TURNSTILE_TOKEN_PATTERN_SOURCE);

export enum TurnstileAction {
  RequestLink = 'request_link',
  SignIn = 'sign_in',
  AdminSignIn = 'admin_sign_in',
}

export enum TurnstileVerdict {
  Accepted = 'accepted',
  Refused = 'refused',
  Unavailable = 'unavailable',
}

export type TurnstileCheck = {
  token: string;
  secret: string;
  hostname: string;
  action: TurnstileAction;
  isLocalHost: boolean;
  fetcher: typeof fetch;
};

const SiteverifyAnswerSchema = z.object({
  success: z.boolean(),
  hostname: z.string().optional(),
  action: z.string().optional(),
  'error-codes': z.array(z.string()).optional(),
});

type SiteverifyAnswer = z.output<typeof SiteverifyAnswerSchema>;

function verdictOf({
  answer,
  hostname,
  action,
}: {
  answer: SiteverifyAnswer;
  hostname: string;
  action: TurnstileAction;
}): TurnstileVerdict {
  const isOwnFault = answer['error-codes']?.some((code) => OWN_FAULT_CODES.includes(code)) === true;
  if (isOwnFault) return TurnstileVerdict.Unavailable;
  const isMatchingChallenge = answer.hostname === hostname && answer.action === action;
  const isAccepted = answer.success && isMatchingChallenge;
  if (!isAccepted) return TurnstileVerdict.Refused;
  return TurnstileVerdict.Accepted;
}

export async function verifyTurnstileToken({
  token,
  secret,
  hostname,
  action,
  isLocalHost,
  fetcher,
}: TurnstileCheck): Promise<TurnstileVerdict> {
  const isLocalDummy = isLocalHost && token === TURNSTILE_DUMMY_TOKEN;
  if (isLocalDummy) return TurnstileVerdict.Accepted;
  const response = await fetcher(SITEVERIFY_URL, {
    method: 'POST',
    body: new URLSearchParams({ secret, response: token }),
    signal: AbortSignal.timeout(SITEVERIFY_TIMEOUT_MS),
  }).catch(() => null);
  if (response === null) return TurnstileVerdict.Unavailable;
  if (!response.ok) return TurnstileVerdict.Unavailable;
  const parsed = SiteverifyAnswerSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) return TurnstileVerdict.Unavailable;
  return verdictOf({ answer: parsed.data, hostname, action });
}
