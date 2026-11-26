import { MILLISECONDS_PER_DAY } from '@todz/types';
import { createExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { CLOUD_COPY } from '../src/cloud-copy';
import { countActiveAccounts, waitingAddresses } from '../src/cloud-queue-store';
import { cloudQueueAddressOf, cloudQueueTokenOf } from '../src/cloud-queue-token';
import type { Env } from '../src/env';
import { escapedHtml } from '../src/escaped-html';
import { TURNSTILE_DUMMY_TOKEN } from '../src/turnstile';
import { serveCloudQueueJoin, serveCloudQueuePage } from '../src/site/cloud-queue-form';
import { serveSite } from '../src/site/site-endpoint';
import { seedOwner } from './directory-seed';
import { freshAddress } from './email-sign-in-client';

const SITE_ORIGIN = 'http://localhost:8788';
const PUBLIC_ORIGIN = 'http://localhost:8787';
const QUEUE_URL = `${SITE_ORIGIN}/cloud-queue`;
const KEY_SECRET = 'sign-up-key-secret-for-tests';
const OK_STATUS = 200;
const BAD_REQUEST_STATUS = 400;
const FORBIDDEN_STATUS = 403;
const TOO_MANY_STATUS = 429;
const UNAVAILABLE_STATUS = 503;
const NOW = Date.now();

function siteEnv(settings: Partial<Env> = {}): Env {
  return { ...env, SITE_ORIGIN, PUBLIC_ORIGIN, SIGN_UP_KEY_SECRET: KEY_SECRET, ...settings };
}

async function fullSettings(): Promise<Partial<Env>> {
  await seedOwner();
  return { CLOUD_ACCOUNTS_MAX: String(await countActiveAccounts({ directory: env.DIRECTORY, now: NOW })) };
}

function tokenOf({ address, now = NOW }: { address: string; now?: number }): Promise<string> {
  return cloudQueueTokenOf({ secret: KEY_SECRET, address, now });
}

function postRequest({ fields, fetchSite = 'same-origin' }: { fields: Record<string, string>; fetchSite?: string }): Request {
  const body = new URLSearchParams(fields).toString();
  return new Request(QUEUE_URL, {
    method: 'POST',
    headers: {
      'Sec-Fetch-Site': fetchSite,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': String(new TextEncoder().encode(body).length),
    },
    body,
  });
}

function join({
  fields,
  settings,
  fetchSite,
}: {
  fields: Record<string, string>;
  settings: Partial<Env>;
  fetchSite?: string;
}): Promise<Response> {
  return serveCloudQueueJoin({
    request: postRequest({ fields, fetchSite }),
    env: siteEnv(settings),
    executionContext: createExecutionContext(),
  });
}

function joinWith({ token, settings }: { token: string; settings: Partial<Env> }): Promise<Response> {
  return join({ fields: { token, 'cf-turnstile-response': TURNSTILE_DUMMY_TOKEN }, settings });
}

async function isQueued(email: string): Promise<boolean> {
  const waiting = await waitingAddresses({ directory: env.DIRECTORY, limit: 1000 });
  return waiting.some((queued) => queued.email === email);
}

async function queuedCount(email: string): Promise<number> {
  const waiting = await waitingAddresses({ directory: env.DIRECTORY, limit: 1000 });
  return waiting.filter((queued) => queued.email === email).length;
}

function page({ search = '', settings = {} }: { search?: string; settings?: Partial<Env> }): Promise<Response> {
  return serveCloudQueuePage({
    request: new Request(`${QUEUE_URL}${search}`),
    env: siteEnv(settings),
    executionContext: createExecutionContext(),
  });
}

describe('the signed queue token', () => {
  test('it carries the address and proves it with the sign-up key until it expires', async () => {
    const address = freshAddress();
    const token = await tokenOf({ address });
    expect(await cloudQueueAddressOf({ secret: KEY_SECRET, token, now: NOW })).toBe(address);
    expect(await cloudQueueAddressOf({ secret: KEY_SECRET, token, now: NOW + 8 * MILLISECONDS_PER_DAY })).toBeNull();
    expect(await cloudQueueAddressOf({ secret: 'another-secret', token, now: NOW })).toBeNull();
  });

  test('a changed address, expiry or signature is not accepted', async () => {
    const address = freshAddress();
    const [addressPart, expiryPart, signature] = (await tokenOf({ address })).split('.');
    const otherAddressPart = [...new TextEncoder().encode(freshAddress())].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    const forged = [
      [otherAddressPart, expiryPart, signature],
      [addressPart, String(NOW + 365 * MILLISECONDS_PER_DAY), signature],
      [addressPart, expiryPart, `${'0'.repeat(63)}1`],
      [addressPart, expiryPart],
      ['zz', expiryPart, signature],
    ].map((parts) => parts.join('.'));
    const answers = await Promise.all(forged.map((token) => cloudQueueAddressOf({ secret: KEY_SECRET, token, now: NOW })));
    expect(answers).toEqual(forged.map(() => null));
  });
});

describe('the cloud queue page', () => {
  test('with a valid link it asks to confirm the masked address, with a Turnstile widget, a strict policy and no indexing', async () => {
    const address = freshAddress();
    const response = await page({ search: `?token=${await tokenOf({ address })}` });
    const html = await response.text();
    expect(response.status).toBe(OK_STATUS);
    expect(html).toContain('method="post" action="/cloud-queue"');
    expect(html).toContain('name="token"');
    expect(html).toContain('data-action="cloud_queue"');
    expect(html).toContain(`${address.slice(0, 1)}…@example.com`);
    expect(html).not.toContain(address);
    expect(html).not.toContain('type="email"');
    expect(html).toContain('https://docs.todz.app/self-host');
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex');
    const policy = response.headers.get('Content-Security-Policy') ?? '';
    expect(policy).toContain("default-src 'none'");
    expect(policy).toContain("form-action 'self'");
    expect(policy).toContain('frame-src https://challenges.cloudflare.com');
    expect(policy).not.toContain("'unsafe-inline'");
  });

  test('without a link, with a forged one or an expired one it shows no form and says the link is not valid', async () => {
    const expired = await tokenOf({ address: freshAddress(), now: NOW - 8 * MILLISECONDS_PER_DAY });
    const answers = await Promise.all(['', '?token=garbage', `?token=${expired}`].map((search) => page({ search })));
    expect(answers.map((answer) => answer.status)).toEqual([BAD_REQUEST_STATUS, BAD_REQUEST_STATUS, BAD_REQUEST_STATUS]);
    const html = await answers[0]?.text();
    expect(html).toContain(escapedHtml(CLOUD_COPY.queuePage.invalidTitle));
    expect(html).not.toContain('<form class="join-form');
  });

  test('it is closed without the Turnstile keys or the sign-up key secret', async () => {
    const token = await tokenOf({ address: freshAddress() });
    const withoutTurnstile = await page({ search: `?token=${token}`, settings: { TURNSTILE_SECRET_KEY: undefined } });
    const withoutKey = await page({ search: `?token=${token}`, settings: { SIGN_UP_KEY_SECRET: undefined } });
    expect([withoutTurnstile.status, withoutKey.status]).toEqual([UNAVAILABLE_STATUS, UNAVAILABLE_STATUS]);
  });

  test('the site serves it on GET, HEAD and POST of /cloud-queue and nothing else', async () => {
    const executionContext = createExecutionContext();
    const [getAnswer, head] = await Promise.all(
      ['GET', 'HEAD'].map((method) => serveSite({ request: new Request(QUEUE_URL, { method }), env: siteEnv(), executionContext })),
    );
    expect([getAnswer?.status, head?.status]).toEqual([BAD_REQUEST_STATUS, BAD_REQUEST_STATUS]);
    const put = await serveSite({ request: new Request(QUEUE_URL, { method: 'PUT' }), env: siteEnv(), executionContext });
    expect(put.status).toBe(404);
  });
});

describe('joining the line with the signed link', () => {
  test('a valid link queues its address once, however often it is posted', async () => {
    const address = freshAddress();
    const token = await tokenOf({ address });
    const settings = await fullSettings();
    const first = await joinWith({ token, settings });
    await joinWith({ token, settings });
    expect(first.status).toBe(OK_STATUS);
    expect(await first.text()).toContain(escapedHtml(CLOUD_COPY.queuePage.queuedTitle));
    expect(await queuedCount(address)).toBe(1);
  });

  test('a valid link queues its address even while the cloud has room, with the same answer', async () => {
    const address = freshAddress();
    const response = await joinWith({ token: await tokenOf({ address }), settings: { CLOUD_ACCOUNTS_MAX: '100000' } });
    expect(await response.text()).toContain(escapedHtml(CLOUD_COPY.queuePage.queuedTitle));
    expect(await isQueued(address)).toBe(true);
  });

  test('a typed address with no token queues nothing', async () => {
    const address = freshAddress();
    const response = await join({
      fields: { email: address, 'cf-turnstile-response': TURNSTILE_DUMMY_TOKEN },
      settings: await fullSettings(),
    });
    expect(response.status).toBe(BAD_REQUEST_STATUS);
    expect(await isQueued(address)).toBe(false);
  });

  test('a typed address beside a token for another address queues only the address of the token', async () => {
    const [signed, typed] = [freshAddress(), freshAddress()];
    const response = await join({
      fields: { email: typed, token: await tokenOf({ address: signed }), 'cf-turnstile-response': TURNSTILE_DUMMY_TOKEN },
      settings: await fullSettings(),
    });
    expect(response.status).toBe(OK_STATUS);
    expect([await isQueued(signed), await isQueued(typed)]).toEqual([true, false]);
  });

  test('a forged or expired token queues nothing', async () => {
    const address = freshAddress();
    const [addressPart, expiryPart] = (await tokenOf({ address })).split('.');
    const forged = `${addressPart}.${expiryPart}.${'0'.repeat(64)}`;
    const expired = await tokenOf({ address, now: NOW - 8 * MILLISECONDS_PER_DAY });
    const settings = await fullSettings();
    const answers = await Promise.all([forged, expired].map((token) => joinWith({ token, settings })));
    expect(answers.map((answer) => answer.status)).toEqual([BAD_REQUEST_STATUS, BAD_REQUEST_STATUS]);
    expect(await isQueued(address)).toBe(false);
  });

  test('a disposable address with a valid token is not queued and the page asks to try again', async () => {
    const address = 'maria@mailinator.com';
    const response = await joinWith({ token: await tokenOf({ address }), settings: await fullSettings() });
    expect(response.status).toBe(TOO_MANY_STATUS);
    expect(await isQueued(address)).toBe(false);
  });

  test('a cross-site post is forbidden and queues nobody', async () => {
    const address = freshAddress();
    const response = await join({
      fields: { token: await tokenOf({ address }), 'cf-turnstile-response': TURNSTILE_DUMMY_TOKEN },
      settings: await fullSettings(),
      fetchSite: 'cross-site',
    });
    expect(response.status).toBe(FORBIDDEN_STATUS);
    expect(await isQueued(address)).toBe(false);
  });

  test('a post without a solved Turnstile token queues nobody', async () => {
    const address = freshAddress();
    const response = await join({ fields: { token: await tokenOf({ address }) }, settings: await fullSettings() });
    expect(response.status).toBe(BAD_REQUEST_STATUS);
    expect(await isQueued(address)).toBe(false);
  });

  test('without the Turnstile keys the line is closed', async () => {
    const address = freshAddress();
    const response = await joinWith({
      token: await tokenOf({ address }),
      settings: { ...(await fullSettings()), TURNSTILE_SECRET_KEY: undefined },
    });
    expect(response.status).toBe(UNAVAILABLE_STATUS);
    expect(await isQueued(address)).toBe(false);
  });
});
