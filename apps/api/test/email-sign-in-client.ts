import { env } from 'cloudflare:workers';
import { type MockInstance, vi } from 'vitest';
import { z } from 'zod';
import { digestCredential } from '../src/credential-digest';
import { generateCredentialSecret } from '../src/credential-secret';
import type { Env } from '../src/env';
import { TURNSTILE_DUMMY_TOKEN, TurnstileAction } from '../src/turnstile';
import { serveOwnerCall, workerEnvWith } from './owner-client';
import { CLOCK_NOW } from './task-fixtures';

export const PUBLIC_ORIGIN = 'http://localhost:8787';
export const LINK_CHALLENGE = 'ab'.repeat(32);
export const RELEASE_LINK_SCHEME = 'todz';
export const DEBUG_LINK_SCHEME = 'todz-dev';

const ACCEPTED_STATUS = 202;
const LINKS_PATH = '/owner/sign-in-links';
const SESSIONS_PATH = '/owner/sessions';
export const TURNSTILE_TEST_SECRET = '1x0000000000000000000000000000000AA';
const SIGN_UP_TEST_KEY_SECRET = 'sign-up-key-secret-for-tests';
export const EMAIL_SETTINGS: Partial<Env> = {
  SIGN_IN_PROVIDER: 'email',
  EMAIL_SENDER: 'console',
  PUBLIC_ORIGIN,
  TURNSTILE_SECRET_KEY: TURNSTILE_TEST_SECRET,
  SIGN_UP_KEY_SECRET: SIGN_UP_TEST_KEY_SECRET,
};
const TOKEN_IN_MAIL_PATTERN = /sign-in#token=([A-Za-z0-9_-]{43})/;
const TOKEN_GROUP = 1;

export const PUBLIC_HTTPS_ORIGIN = 'https://todz.app';
const PUBLIC_HTTPS_HOSTNAME = 'todz.app';
export const CLOUDFLARE_SETTINGS: Partial<Env> = {
  SIGN_IN_PROVIDER: 'email',
  EMAIL_SENDER: 'cloudflare',
  PUBLIC_ORIGIN: PUBLIC_HTTPS_ORIGIN,
  SIGN_UP_KEY_SECRET: SIGN_UP_TEST_KEY_SECRET,
};
export const CLIENT_ADDRESS_HEADER = 'CF-Connecting-IP';
export const CLIENT_ADDRESS = '203.0.113.50';
const CLIENT_HEADERS = { [CLIENT_ADDRESS_HEADER]: CLIENT_ADDRESS };
const SITEVERIFY_RESPONSE_FIELD = 'response';

export const TURNSTILE_TOKEN_OF_ACTION: Record<TurnstileAction, string> = {
  [TurnstileAction.RequestLink]: 'solved.request-link.token',
  [TurnstileAction.SignIn]: 'solved.sign-in.token',
  [TurnstileAction.AdminSignIn]: 'solved.admin-sign-in.token',
  [TurnstileAction.CloudQueue]: 'solved.cloud-queue.token',
};

export type RecordingLimiter = { limiter: RateLimit; keys: string[] };

export function recordingLimiter({ isAllowed }: { isAllowed: boolean }): RecordingLimiter {
  const keys: string[] = [];
  const limiter: RateLimit = {
    async limit({ key }) {
      keys.push(key);
      return { success: isAllowed };
    },
  };
  return { limiter, keys };
}

export function guardedSettings(): Partial<Env> {
  return {
    ...CLOUDFLARE_SETTINGS,
    TURNSTILE_SECRET_KEY: TURNSTILE_TEST_SECRET,
    SIGN_IN_LIMITER: recordingLimiter({ isAllowed: true }).limiter,
    SIGN_IN_ADDRESS_LIMITER: recordingLimiter({ isAllowed: true }).limiter,
    SIGN_IN_GLOBAL_LIMITER: recordingLimiter({ isAllowed: true }).limiter,
  };
}

function actionOfToken(token: string | null): TurnstileAction | undefined {
  return Object.values(TurnstileAction).find((action) => TURNSTILE_TOKEN_OF_ACTION[action] === token);
}

export function acceptingSiteverify(): MockInstance<typeof fetch> {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
    const action = actionOfToken(new URLSearchParams(String(init?.body)).get(SITEVERIFY_RESPONSE_FIELD));
    if (action === undefined) return Response.json({ success: false, 'error-codes': ['invalid-input-response'] });
    return Response.json({ success: true, hostname: PUBLIC_HTTPS_HOSTNAME, action });
  });
}

const SentMessageSchema = z.object({
  from: z.object({ name: z.string(), email: z.string() }),
  replyTo: z.string(),
  headers: z.record(z.string(), z.string()).optional(),
  to: z.string(),
  subject: z.string(),
  html: z.string(),
  text: z.string(),
});

export type SentMessage = z.output<typeof SentMessageSchema>;

export type RecordingBinding = { binding: SendEmail; sent: SentMessage[] };

export function recordingBinding(): RecordingBinding {
  const sent: SentMessage[] = [];
  const binding: SendEmail = {
    async send(message: EmailMessage | EmailMessageBuilder) {
      sent.push(SentMessageSchema.parse(message));
      return { messageId: crypto.randomUUID() };
    },
  };
  return { binding, sent };
}

export function messageSent(sent: SentMessage[]): SentMessage {
  const [message, ...others] = sent;
  if (message === undefined || others.length > 0) throw new Error('exactly one message should have been sent');
  return message;
}

export function bindingFailingWith(failure: Error): SendEmail {
  return {
    async send() {
      throw failure;
    },
  };
}

export type SentMail = { to: string; replyTo: string; text: string };

export type LinkRow = {
  digest: string;
  email: string;
  challenge: string;
  created_at: number;
  expires_at: number;
  consumed_at: number | null;
};

export function freshAddress(): string {
  return `${crypto.randomUUID()}@example.com`;
}

export function emailEnv(settings: Partial<Env> = {}): Env {
  return workerEnvWith({ ...EMAIL_SETTINGS, ...settings });
}

export function consoleOutput(): MockInstance<typeof console.log> {
  return vi.spyOn(console, 'log').mockImplementation(() => undefined);
}

export function sentMail(output: MockInstance<typeof console.log>): SentMail[] {
  return output.mock.calls.map(([line]) => JSON.parse(String(line)) as SentMail);
}

export function mailSent(output: MockInstance<typeof console.log>): SentMail {
  const [mail, ...others] = sentMail(output);
  if (mail === undefined || others.length > 0) throw new Error('exactly one mail should have been sent');
  return mail;
}

export function tokenOfMail(mail: SentMail): string {
  const token = TOKEN_IN_MAIL_PATTERN.exec(mail.text)?.[TOKEN_GROUP];
  if (token === undefined) throw new Error('the mail should carry a sign-in link');
  return token;
}

export function requestLink({
  email = freshAddress(),
  challenge = LINK_CHALLENGE,
  now = CLOCK_NOW,
  workerEnv = emailEnv(),
  origin = PUBLIC_ORIGIN,
  turnstileToken = TURNSTILE_DUMMY_TOKEN,
  appLinkScheme = RELEASE_LINK_SCHEME,
  headers = {},
}: {
  email?: unknown;
  challenge?: unknown;
  now?: number;
  workerEnv?: Env;
  origin?: string;
  turnstileToken?: unknown;
  appLinkScheme?: unknown;
  headers?: Record<string, string>;
} = {}): Promise<Response> {
  const body = { email, link_challenge: challenge, turnstile_token: turnstileToken, app_link_scheme: appLinkScheme };
  return serveOwnerCall({
    call: { method: 'POST', path: LINKS_PATH, body, headers: { ...CLIENT_HEADERS, ...headers }, origin },
    now,
    workerEnv,
  });
}

export async function askedLink({
  email = freshAddress(),
  verifier = generateCredentialSecret(),
  now = CLOCK_NOW,
}: { email?: string; verifier?: string; now?: number } = {}): Promise<{ email: string; verifier: string; token: string }> {
  const output = consoleOutput();
  const response = await requestLink({ email, challenge: await digestCredential(verifier), now });
  if (response.status !== ACCEPTED_STATUS) throw new Error(`asking for a link answered ${response.status}`);
  const token = tokenOfMail(mailSent(output));
  output.mockRestore();
  return { email, verifier, token };
}

export function redeemLink({
  token,
  verifier,
  now = CLOCK_NOW,
  timeZone = 'UTC',
  workerEnv = emailEnv(),
  executionContext,
  turnstileToken = TURNSTILE_DUMMY_TOKEN,
  headers = {},
}: {
  token: string;
  verifier?: string;
  now?: number;
  timeZone?: string;
  workerEnv?: Env;
  executionContext?: ExecutionContext;
  turnstileToken?: unknown;
  headers?: Record<string, string>;
}): Promise<Response> {
  return serveOwnerCall({
    call: {
      method: 'POST',
      path: SESSIONS_PATH,
      body: { identity_token: token, link_verifier: verifier, time_zone: timeZone, turnstile_token: turnstileToken },
      headers: { ...CLIENT_HEADERS, ...headers },
    },
    now,
    workerEnv,
    executionContext,
  });
}

export async function linkRows(email: string): Promise<LinkRow[]> {
  const { results } = await env.DIRECTORY.prepare(
    'SELECT digest, email, challenge, created_at, expires_at, consumed_at FROM sign_in_links WHERE email = ? ORDER BY created_at, rowid',
  )
    .bind(email)
    .all<LinkRow>();
  return results;
}
