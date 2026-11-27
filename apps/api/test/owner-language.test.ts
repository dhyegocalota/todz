import { LANGUAGE_PROFILES, Language } from '@todz/types';
import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { findOwner } from '../src/directory-owners';
import { listDayEmailCandidates } from '../src/project-routing';
import { TurnstileAction } from '../src/turnstile';
import { seedDayOwner, tick, mailTo, resetDayEmails } from './day-email/day-email-client';
import {
  TURNSTILE_TOKEN_OF_ACTION,
  acceptingSiteverify,
  askedLink,
  emailEnv,
  freshAddress,
  guardedSettings,
  recordingBinding,
  redeemLink,
  requestLink,
  messageSent,
} from './email-sign-in-client';
import { recordingEnv, serveOwnerCall, signInCall } from './owner-client';
import { CLOCK_NOW } from './task-fixtures';

const ACCEPT_LANGUAGE = 'Accept-Language';
const SIGN_IN_TOKEN = TURNSTILE_TOKEN_OF_ACTION[TurnstileAction.SignIn];
const SIGNUPS_PER_CLIENT = '1000';
const UPDATE_LANGUAGE_PATTERN = /^UPDATE owners SET.*language/s;
const CORRUPT_LANGUAGE = 'xx';
const UNSUPPORTED_RANGE = 'tlh-KX, xx;q=0.5';

type LanguageRow = { language: string };
type SignedIn = { ownerId: string; token: string };

async function storedLanguageOf(ownerId: string): Promise<string> {
  const row = await env.DIRECTORY.prepare('SELECT language FROM owners WHERE id = ?').bind(ownerId).first<LanguageRow>();
  if (row === null) throw new Error('the owner should exist');
  return row.language;
}

async function signInWith({
  identityToken = crypto.randomUUID(),
  acceptLanguage,
}: {
  identityToken?: string;
  acceptLanguage?: string;
}): Promise<SignedIn> {
  const call = signInCall({ identityToken, timeZone: 'UTC' });
  const headers: Record<string, string> = acceptLanguage === undefined ? {} : { [ACCEPT_LANGUAGE]: acceptLanguage };
  const response = await serveOwnerCall({ call: { ...call, headers }, now: CLOCK_NOW });
  const answer = await response.json<{ session_token: string; owner: { id: string } }>();
  return { ownerId: answer.owner.id, token: answer.session_token };
}

async function readOwnerWith({
  token,
  acceptLanguage,
  workerEnv,
}: {
  token: string;
  acceptLanguage?: string;
  workerEnv?: ReturnType<typeof recordingEnv>['workerEnv'];
}): Promise<Response> {
  const headers: Record<string, string> = acceptLanguage === undefined ? {} : { [ACCEPT_LANGUAGE]: acceptLanguage };
  return serveOwnerCall({ call: { method: 'GET', path: '/owner', token, headers }, now: CLOCK_NOW, workerEnv });
}

async function languageUpdatesOf({ token, acceptLanguage }: { token: string; acceptLanguage?: string }): Promise<number> {
  const { workerEnv, statements } = recordingEnv();
  const response = await readOwnerWith({ token, acceptLanguage, workerEnv });
  expect(response.status).toBe(200);
  return statements.filter((statement) => UPDATE_LANGUAGE_PATTERN.test(statement)).length;
}

describe('the language of a new owner', () => {
  test('is the supported language of the sign-in Accept-Language', async () => {
    const owner = await signInWith({ acceptLanguage: 'pt-BR,pt;q=0.9,en;q=0.8' });
    expect(await storedLanguageOf(owner.ownerId)).toBe(Language.PortugueseBrazil);
  });

  test.each([
    ['no header', undefined],
    ['an unsupported language', UNSUPPORTED_RANGE],
  ])('is English with %s', async (_name, acceptLanguage) => {
    const owner = await signInWith({ acceptLanguage });
    expect(await storedLanguageOf(owner.ownerId)).toBe(Language.English);
  });
});

describe('the language of a known owner at sign-in', () => {
  test('follows a different supported language', async () => {
    const identityToken = crypto.randomUUID();
    const first = await signInWith({ identityToken, acceptLanguage: 'ja' });
    await signInWith({ identityToken, acceptLanguage: 'fr-CA' });
    expect(await storedLanguageOf(first.ownerId)).toBe(Language.French);
  });

  test.each([
    ['no header', undefined],
    ['an unsupported language', UNSUPPORTED_RANGE],
  ])('stays with %s', async (_name, acceptLanguage) => {
    const identityToken = crypto.randomUUID();
    const first = await signInWith({ identityToken, acceptLanguage: 'ko' });
    await signInWith({ identityToken, acceptLanguage });
    expect(await storedLanguageOf(first.ownerId)).toBe(Language.Korean);
  });
});

describe('the language of an authenticated owner request', () => {
  test('changes once to a different supported language, then writes nothing while it stays', async () => {
    const owner = await signInWith({ acceptLanguage: 'pt-BR' });
    expect(await languageUpdatesOf({ token: owner.token, acceptLanguage: 'de' })).toBe(1);
    expect(await storedLanguageOf(owner.ownerId)).toBe(Language.German);
    expect(await languageUpdatesOf({ token: owner.token, acceptLanguage: 'de-AT,de;q=0.9' })).toBe(0);
    expect(await storedLanguageOf(owner.ownerId)).toBe(Language.German);
  });

  test.each([
    ['no header', undefined],
    ['an unsupported language', UNSUPPORTED_RANGE],
  ])('is left alone by %s', async (_name, acceptLanguage) => {
    const owner = await signInWith({ acceptLanguage: 'es' });
    expect(await languageUpdatesOf({ token: owner.token, acceptLanguage })).toBe(0);
    expect(await storedLanguageOf(owner.ownerId)).toBe(Language.Spanish);
  });
});

describe('a stored language outside the enum', () => {
  test('is refused when the owner is read', async () => {
    const owner = await signInWith({ acceptLanguage: 'en' });
    await env.DIRECTORY.prepare('UPDATE owners SET language = ? WHERE id = ?').bind(CORRUPT_LANGUAGE, owner.ownerId).run();
    await expect(findOwner({ directory: env.DIRECTORY, ownerId: owner.ownerId })).rejects.toThrow(CORRUPT_LANGUAGE);
  });
});

describe('the mails of an owner', () => {
  beforeEach(() => {
    acceptingSiteverify();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('the app sign-in link mail speaks the Accept-Language of the request', async () => {
    const { binding, sent } = recordingBinding();
    const workerEnv = emailEnv({ EMAIL: binding, EMAIL_SENDER: 'cloudflare' });
    await requestLink({ workerEnv, headers: { [ACCEPT_LANGUAGE]: 'ja,en;q=0.5' } });
    expect(messageSent(sent).html).toContain(`lang="${LANGUAGE_PROFILES[Language.Japanese].htmlLang}"`);
  });

  test('the app sign-in link mail is English without the header', async () => {
    const { binding, sent } = recordingBinding();
    const workerEnv = emailEnv({ EMAIL: binding, EMAIL_SENDER: 'cloudflare' });
    await requestLink({ workerEnv });
    expect(messageSent(sent).html).toContain('lang="en"');
  });

  test('the welcome mail speaks the language the new owner was stored with', async () => {
    const { binding, sent } = recordingBinding();
    const link = await askedLink({ email: freshAddress() });
    const workerEnv = emailEnv({ ...guardedSettings(), EMAIL: binding, FAIR_USE_SIGN_UPS_PER_CLIENT_DAY_MAX: SIGNUPS_PER_CLIENT });
    const response = await redeemLink({ ...link, turnstileToken: SIGN_IN_TOKEN, workerEnv, headers: { [ACCEPT_LANGUAGE]: 'zh-CN' } });
    expect(response.status).toBe(201);
    expect(messageSent(sent).html).toContain(`lang="${LANGUAGE_PROFILES[Language.Chinese].htmlLang}"`);
  });
});

describe('the day mail', () => {
  beforeEach(async () => {
    await resetDayEmails();
  });

  test('carries the stored language of the owner in its candidate', async () => {
    const owner = await seedDayOwner();
    await env.DIRECTORY.prepare('UPDATE owners SET language = ? WHERE id = ?').bind(Language.German, owner.ownerId).run();
    const candidates = await listDayEmailCandidates({ env, now: Date.now() });
    expect(candidates.find((candidate) => candidate.owner.ownerId === owner.ownerId)?.language).toBe(Language.German);
  });

  test('is sent in the stored language of the owner', async () => {
    const owner = await seedDayOwner();
    await env.DIRECTORY.prepare('UPDATE owners SET language = ? WHERE id = ?').bind(Language.Korean, owner.ownerId).run();
    const recording = recordingBinding();
    await tick({ recording });
    expect(mailTo({ recording, address: owner.address }).html).toContain(`lang="${LANGUAGE_PROFILES[Language.Korean].htmlLang}"`);
  });
});
