import { LANGUAGE_PROFILES, Language, MINIMUM_APP_VERSION } from '@todz/types';
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
const APP_VERSION_HEADER = 'Todz-App-Version';
const LANGUAGE_REPORTING_VERSION = '0.2.9';
const OLDER_VERSION = '0.2.8';
const UNSUPPORTED_RANGE = 'tlh-KX, xx;q=0.5';

type LanguageRow = { language: string };
type SignedIn = { ownerId: string; token: string };

async function storedLanguageOf(ownerId: string): Promise<string> {
  const row = await env.DIRECTORY.prepare('SELECT language FROM owners WHERE id = ?').bind(ownerId).first<LanguageRow>();
  if (row === null) throw new Error('the owner should exist');
  return row.language;
}

function languageHeadersOf({ acceptLanguage, appVersion }: { acceptLanguage?: string; appVersion?: string }): Record<string, string> {
  const languageHeaders: Record<string, string> = acceptLanguage === undefined ? {} : { [ACCEPT_LANGUAGE]: acceptLanguage };
  if (appVersion === undefined) return languageHeaders;
  return { ...languageHeaders, [APP_VERSION_HEADER]: appVersion };
}

async function signInWith({
  identityToken = crypto.randomUUID(),
  acceptLanguage,
  appVersion = LANGUAGE_REPORTING_VERSION,
}: {
  identityToken?: string;
  acceptLanguage?: string;
  appVersion?: string;
}): Promise<SignedIn> {
  const call = signInCall({ identityToken, timeZone: 'UTC' });
  const headers = languageHeadersOf({ acceptLanguage, appVersion });
  const response = await serveOwnerCall({ call: { ...call, headers }, now: CLOCK_NOW });
  const answer = await response.json<{ session_token: string; owner: { id: string } }>();
  return { ownerId: answer.owner.id, token: answer.session_token };
}

async function readOwnerWith({
  token,
  acceptLanguage,
  appVersion = LANGUAGE_REPORTING_VERSION,
  workerEnv,
}: {
  token: string;
  acceptLanguage?: string;
  appVersion?: string;
  workerEnv?: ReturnType<typeof recordingEnv>['workerEnv'];
}): Promise<Response> {
  const headers = languageHeadersOf({ acceptLanguage, appVersion });
  return serveOwnerCall({ call: { method: 'GET', path: '/owner', token, headers }, now: CLOCK_NOW, workerEnv });
}

async function languageUpdatesOf({
  token,
  acceptLanguage,
  appVersion,
}: {
  token: string;
  acceptLanguage?: string;
  appVersion?: string;
}): Promise<number> {
  const { workerEnv, statements } = recordingEnv();
  const response = await readOwnerWith({ token, acceptLanguage, appVersion, workerEnv });
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

  test.each([OLDER_VERSION, MINIMUM_APP_VERSION])('stays when an app of version %s signs in with English', async (appVersion) => {
    const identityToken = crypto.randomUUID();
    const first = await signInWith({ identityToken, acceptLanguage: 'ko' });
    await signInWith({ identityToken, acceptLanguage: 'en', appVersion });
    expect(await storedLanguageOf(first.ownerId)).toBe(Language.Korean);
  });
});

describe('the language of an authenticated owner request', () => {
  test('changes once to a different supported language, then writes nothing while it stays', async () => {
    const owner = await signInWith({ acceptLanguage: 'pt-BR' });
    expect(await languageUpdatesOf({ token: owner.token, acceptLanguage: 'de' })).toBe(1);
    expect(await storedLanguageOf(owner.ownerId)).toBe(Language.German);
    expect(await languageUpdatesOf({ token: owner.token, acceptLanguage: 'de-AT,de;q=0.9' })).toBeLessThanOrEqual(1);
    expect(await storedLanguageOf(owner.ownerId)).toBe(Language.German);
  });

  test.each([OLDER_VERSION, MINIMUM_APP_VERSION])('an app of version %s never overwrites it', async (appVersion) => {
    const owner = await signInWith({ acceptLanguage: 'ko' });
    expect(await languageUpdatesOf({ token: owner.token, acceptLanguage: 'en', appVersion })).toBe(0);
    expect(await storedLanguageOf(owner.ownerId)).toBe(Language.Korean);
  });

  test('a request with no app version never overwrites it', async () => {
    const owner = await signInWith({ acceptLanguage: 'ko' });
    const { workerEnv, statements } = recordingEnv();
    const response = await serveOwnerCall({
      call: { method: 'GET', path: '/owner', token: owner.token, headers: { [ACCEPT_LANGUAGE]: 'en' } },
      now: CLOCK_NOW,
      workerEnv,
    });
    expect(response.status).toBe(200);
    expect(statements.filter((statement) => UPDATE_LANGUAGE_PATTERN.test(statement))).toEqual([]);
    expect(await storedLanguageOf(owner.ownerId)).toBe(Language.Korean);
  });

  test('version 0.2.9 and a later one update it', async () => {
    const owner = await signInWith({ acceptLanguage: 'ko' });
    await readOwnerWith({ token: owner.token, acceptLanguage: 'fr', appVersion: '0.2.9' });
    await readOwnerWith({ token: owner.token, acceptLanguage: 'ja', appVersion: '0.3.0' });
    expect(await storedLanguageOf(owner.ownerId)).toBe(Language.Japanese);
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
  test('never fails a request or a read of the owner', async () => {
    const owner = await signInWith({ acceptLanguage: 'en' });
    await env.DIRECTORY.prepare('UPDATE owners SET language = ? WHERE id = ?').bind(CORRUPT_LANGUAGE, owner.ownerId).run();
    expect((await readOwnerWith({ token: owner.token })).status).toBe(200);
    expect(await findOwner({ directory: env.DIRECTORY, ownerId: owner.ownerId })).not.toBeNull();
  });

  test('is repaired by a language-reporting app', async () => {
    const owner = await signInWith({ acceptLanguage: 'en' });
    await env.DIRECTORY.prepare('UPDATE owners SET language = ? WHERE id = ?').bind(CORRUPT_LANGUAGE, owner.ownerId).run();
    await readOwnerWith({ token: owner.token, acceptLanguage: 'de' });
    expect(await storedLanguageOf(owner.ownerId)).toBe(Language.German);
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

  test('skips the owner of an unsupported stored value, logs the reason without the address, and mails the others', async () => {
    const broken = await seedDayOwner();
    const healthy = await seedDayOwner();
    await env.DIRECTORY.prepare('UPDATE owners SET language = ? WHERE id = ?').bind(CORRUPT_LANGUAGE, broken.ownerId).run();
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const recording = recordingBinding();
    await tick({ recording });
    const logged = log.mock.calls.map(([line]) => String(line)).join('\n');
    expect(logged).toContain('day_email_language_unsupported');
    expect(logged).not.toContain(broken.address);
    expect(recording.sent.filter(({ to }) => to === broken.address)).toEqual([]);
    expect(mailTo({ recording, address: healthy.address }).html).toContain('lang="en"');
    log.mockRestore();
  });

  test('is sent in the stored language of the owner', async () => {
    const owner = await seedDayOwner();
    await env.DIRECTORY.prepare('UPDATE owners SET language = ? WHERE id = ?').bind(Language.Korean, owner.ownerId).run();
    const recording = recordingBinding();
    await tick({ recording });
    expect(mailTo({ recording, address: owner.address }).html).toContain(`lang="${LANGUAGE_PROFILES[Language.Korean].htmlLang}"`);
  });
});
