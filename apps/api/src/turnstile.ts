export const TURNSTILE_DUMMY_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';

export enum TurnstileAction {
  RequestLink = 'request_link',
  SignIn = 'sign_in',
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

export async function verifyTurnstileToken(_check: TurnstileCheck): Promise<TurnstileVerdict> {
  throw new Error('verifyTurnstileToken is not implemented');
}
