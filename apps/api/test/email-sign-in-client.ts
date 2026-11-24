import { env } from 'cloudflare:workers';
import { type MockInstance, vi } from 'vitest';
import type { Env } from '../src/env';
import { serveOwnerCall, workerEnvWith } from './owner-client';
import { CLOCK_NOW } from './task-fixtures';

export const PUBLIC_ORIGIN = 'http://localhost:8787';
export const LINK_CHALLENGE = 'ab'.repeat(32);
export const MAIL_ADDRESS = 'maria@example.com';

const LINKS_PATH = '/owner/sign-in-links';
const SESSIONS_PATH = '/owner/sessions';
export const EMAIL_SETTINGS: Partial<Env> = { SIGN_IN_PROVIDER: 'email', EMAIL_SENDER: 'console', PUBLIC_ORIGIN };
const TOKEN_IN_MAIL_PATTERN = /sign-in#token=([A-Za-z0-9_-]{43})/;
const TOKEN_GROUP = 1;

export type SentMail = { to: string; text: string };

export type LinkRow = {
  digest: string;
  email: string;
  challenge: string;
  created_at: number;
  expires_at: number;
  consumed_at: number | null;
};

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
  email = MAIL_ADDRESS,
  challenge = LINK_CHALLENGE,
  now = CLOCK_NOW,
  workerEnv = emailEnv(),
}: {
  email?: unknown;
  challenge?: unknown;
  now?: number;
  workerEnv?: Env;
} = {}): Promise<Response> {
  return serveOwnerCall({
    call: { method: 'POST', path: LINKS_PATH, body: { email, link_challenge: challenge } },
    now,
    workerEnv,
  });
}

export function redeemLink({
  token,
  verifier,
  now = CLOCK_NOW,
  timeZone = 'UTC',
  workerEnv = emailEnv(),
}: {
  token: string;
  verifier?: string;
  now?: number;
  timeZone?: string;
  workerEnv?: Env;
}): Promise<Response> {
  return serveOwnerCall({
    call: { method: 'POST', path: SESSIONS_PATH, body: { identity_token: token, link_verifier: verifier, time_zone: timeZone } },
    now,
    workerEnv,
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
