export const DAY_EMAIL_STOP_PATH = '/day-email/stop';
export const DAY_EMAIL_STOP_TOKEN_PARAMETER = 'token';

export function stopUrlOf({ origin, token }: { origin: string; token: string }): string {
  return `${origin}${DAY_EMAIL_STOP_PATH}?${DAY_EMAIL_STOP_TOKEN_PARAMETER}=${token}`;
}
