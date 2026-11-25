import { afterEach, describe, expect, test, vi } from 'vitest';
import { TURNSTILE_DUMMY_TOKEN, TurnstileAction, type TurnstileCheck, TurnstileVerdict, verifyTurnstileToken } from '../src/turnstile';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const SECRET = '1x0000000000000000000000000000000AA';
const TOKEN = 'a-solved.challenge_token';
const HOSTNAME = 'api.todz.app';
const OTHER_HOSTNAME = 'evil.example';
const SERVER_ERROR_STATUS = 500;
const SITEVERIFY_TIMEOUT_MS = 5_000;
const TIMEOUT_ERROR_NAME = 'TimeoutError';
const ACCEPTED_ANSWER = { success: true, hostname: HOSTNAME, action: TurnstileAction.RequestLink };

type FetcherCall = { url: string; init: RequestInit | undefined };

function answeringFetcher(answer: () => Promise<Response>): { fetcher: typeof fetch; calls: FetcherCall[] } {
  const calls: FetcherCall[] = [];
  const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return answer();
  }) as unknown as typeof fetch;
  return { fetcher, calls };
}

function jsonFetcher(body: unknown): { fetcher: typeof fetch; calls: FetcherCall[] } {
  return answeringFetcher(async () => Response.json(body));
}

function check(settings: Partial<TurnstileCheck> & { fetcher: typeof fetch }): TurnstileCheck {
  return { token: TOKEN, secret: SECRET, hostname: HOSTNAME, action: TurnstileAction.RequestLink, isLocalHost: false, ...settings };
}

function hangingUntilAborted(): typeof fetch {
  return ((_url: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
    })) as typeof fetch;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('verifyTurnstileToken', () => {
  test('accepts a successful answer for the expected host and action', async () => {
    const { fetcher } = jsonFetcher(ACCEPTED_ANSWER);
    expect(await verifyTurnstileToken(check({ fetcher }))).toBe(TurnstileVerdict.Accepted);
  });

  test('posts the secret and the token as a form to siteverify, and never the client address', async () => {
    const { fetcher, calls } = jsonFetcher(ACCEPTED_ANSWER);
    await verifyTurnstileToken(check({ fetcher }));
    const [call, ...others] = calls;
    expect(others).toEqual([]);
    expect(call?.url).toBe(SITEVERIFY_URL);
    expect(call?.init?.method).toBe('POST');
    const form = call?.init?.body;
    expect(form).toBeInstanceOf(URLSearchParams);
    expect(Object.fromEntries(form as URLSearchParams)).toEqual({ secret: SECRET, response: TOKEN });
    expect(call?.init?.signal).toBeInstanceOf(AbortSignal);
  });

  test.each([
    ['success false', { success: false, 'error-codes': ['invalid-input-response'] }],
    ['a spent token', { success: false, 'error-codes': ['timeout-or-duplicate'] }],
    ['a wrong hostname', { ...ACCEPTED_ANSWER, hostname: OTHER_HOSTNAME }],
    ['a wrong action', { ...ACCEPTED_ANSWER, action: TurnstileAction.SignIn }],
    ['no hostname', { success: true, action: TurnstileAction.RequestLink }],
    ['no action', { success: true, hostname: HOSTNAME }],
  ])('refuses %s', async (_name, answer) => {
    const { fetcher } = jsonFetcher(answer);
    expect(await verifyTurnstileToken(check({ fetcher }))).toBe(TurnstileVerdict.Refused);
  });

  test.each([['missing-input-secret'], ['invalid-input-secret'], ['internal-error']])(
    'answers unavailable when siteverify names our own fault %s',
    async (errorCode) => {
      const { fetcher } = jsonFetcher({ success: false, 'error-codes': [errorCode] });
      expect(await verifyTurnstileToken(check({ fetcher }))).toBe(TurnstileVerdict.Unavailable);
    },
  );

  test.each([
    ['a fetch that throws', answeringFetcher(() => Promise.reject(new TypeError('network down'))).fetcher],
    ['a non-2xx answer', answeringFetcher(async () => new Response('down', { status: SERVER_ERROR_STATUS })).fetcher],
    ['malformed JSON', answeringFetcher(async () => new Response('not json')).fetcher],
    ['an answer without success', jsonFetcher({ hostname: HOSTNAME }).fetcher],
    ['an answer that is not an object', jsonFetcher([true]).fetcher],
  ])('answers unavailable on %s', async (_name, fetcher) => {
    expect(await verifyTurnstileToken(check({ fetcher }))).toBe(TurnstileVerdict.Unavailable);
  });

  test('bounds siteverify by a 5-second timeout, and answers unavailable when it fires before an answer', async () => {
    const timeout = new AbortController();
    const timeoutSignal = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeout.signal);
    const verdict = verifyTurnstileToken(check({ fetcher: hangingUntilAborted() }));
    timeout.abort(new DOMException('siteverify took too long', TIMEOUT_ERROR_NAME));
    expect(await verdict).toBe(TurnstileVerdict.Unavailable);
    expect(timeoutSignal).toHaveBeenCalledExactlyOnceWith(SITEVERIFY_TIMEOUT_MS);
  });

  test('accepts the dummy token on a local host without a call', async () => {
    const { fetcher, calls } = jsonFetcher(ACCEPTED_ANSWER);
    expect(await verifyTurnstileToken(check({ fetcher, token: TURNSTILE_DUMMY_TOKEN, isLocalHost: true }))).toBe(TurnstileVerdict.Accepted);
    expect(calls).toEqual([]);
  });

  test('sends the dummy token to siteverify on a public host', async () => {
    const { fetcher, calls } = jsonFetcher({ success: false, 'error-codes': ['invalid-input-response'] });
    expect(await verifyTurnstileToken(check({ fetcher, token: TURNSTILE_DUMMY_TOKEN }))).toBe(TurnstileVerdict.Refused);
    expect(calls).toHaveLength(1);
  });

  test('sends any other token to siteverify on a local host', async () => {
    const { fetcher, calls } = jsonFetcher(ACCEPTED_ANSWER);
    expect(await verifyTurnstileToken(check({ fetcher, isLocalHost: true }))).toBe(TurnstileVerdict.Accepted);
    expect(calls).toHaveLength(1);
  });
});
