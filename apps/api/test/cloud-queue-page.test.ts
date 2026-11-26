import { createExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { CLOUD_COPY } from '../src/cloud-copy';
import { countActiveAccounts, waitingAddresses } from '../src/cloud-queue-store';
import type { Env } from '../src/env';
import { escapedHtml } from '../src/escaped-html';
import { TURNSTILE_DUMMY_TOKEN } from '../src/turnstile';
import { serveCloudQueueJoin, serveCloudQueuePage } from '../src/site/cloud-queue-form';
import { serveSite } from '../src/site/site-endpoint';
import { seedEmailIdentity, seedOwner } from './directory-seed';
import { freshAddress } from './email-sign-in-client';

const SITE_ORIGIN = 'http://localhost:8788';
const PUBLIC_ORIGIN = 'http://localhost:8787';
const QUEUE_URL = `${SITE_ORIGIN}/cloud-queue`;
const OK_STATUS = 200;
const FORBIDDEN_STATUS = 403;
const TOO_MANY_STATUS = 429;
const UNAVAILABLE_STATUS = 503;
const NOW = Date.now();

function siteEnv(settings: Partial<Env> = {}): Env {
  return { ...env, SITE_ORIGIN, PUBLIC_ORIGIN, ...settings };
}

async function fullSettings(): Promise<Partial<Env>> {
  await seedOwner();
  return { CLOUD_ACCOUNTS_MAX: String(await countActiveAccounts({ directory: env.DIRECTORY, now: NOW })) };
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

async function isQueued(email: string): Promise<boolean> {
  const waiting = await waitingAddresses({ directory: env.DIRECTORY, limit: 1000 });
  return waiting.some((queued) => queued.email === email);
}

describe('the cloud queue page', () => {
  test('it is a form with a Turnstile widget, a strict policy, no indexing, the limited-spots copy and the self-host link', async () => {
    const response = serveCloudQueuePage({
      request: new Request(QUEUE_URL),
      env: siteEnv(),
      executionContext: createExecutionContext(),
    });
    const page = await response.text();
    expect(response.status).toBe(OK_STATUS);
    expect(page).toContain('method="post" action="/cloud-queue"');
    expect(page).toContain('data-action="cloud_queue"');
    expect(page).toContain('type="email"');
    expect(page).toContain(CLOUD_COPY.queuePage.lead);
    expect(page).toContain('extremely limited');
    expect(page).toContain('https://docs.todz.app/self-host');
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex');
    const policy = response.headers.get('Content-Security-Policy') ?? '';
    expect(policy).toContain("default-src 'none'");
    expect(policy).toContain("form-action 'self'");
    expect(policy).toContain('frame-src https://challenges.cloudflare.com');
    expect(policy).not.toContain("'unsafe-inline'");
  });

  test('it is closed without the Turnstile keys', async () => {
    const response = serveCloudQueuePage({
      request: new Request(QUEUE_URL),
      env: siteEnv({ TURNSTILE_SECRET_KEY: undefined }),
      executionContext: createExecutionContext(),
    });
    expect(response.status).toBe(UNAVAILABLE_STATUS);
    expect(await response.text()).not.toContain('<form class="join-form');
  });

  test('the site serves it on GET, HEAD and POST of /cloud-queue and nothing else', async () => {
    const executionContext = createExecutionContext();
    const [page, head] = await Promise.all(
      ['GET', 'HEAD'].map((method) => serveSite({ request: new Request(QUEUE_URL, { method }), env: siteEnv(), executionContext })),
    );
    expect([page?.status, head?.status]).toEqual([OK_STATUS, OK_STATUS]);
    const put = await serveSite({ request: new Request(QUEUE_URL, { method: 'PUT' }), env: siteEnv(), executionContext });
    expect(put.status).toBe(404);
  });
});

describe('leaving an address on the cloud queue page', () => {
  test('a new address is queued when the cloud is full and the page says so', async () => {
    const email = freshAddress();
    const response = await join({ fields: { email, 'cf-turnstile-response': TURNSTILE_DUMMY_TOKEN }, settings: await fullSettings() });
    expect(response.status).toBe(OK_STATUS);
    expect(await response.text()).toContain(escapedHtml(CLOUD_COPY.queuePage.queuedTitle));
    expect(await isQueued(email)).toBe(true);
  });

  test('an address is not queued while the cloud has room, and the page answers alike', async () => {
    const email = freshAddress();
    const response = await join({
      fields: { email, 'cf-turnstile-response': TURNSTILE_DUMMY_TOKEN },
      settings: { CLOUD_ACCOUNTS_MAX: '100000' },
    });
    expect(await response.text()).toContain(escapedHtml(CLOUD_COPY.queuePage.queuedTitle));
    expect(await isQueued(email)).toBe(false);
  });

  test('an address that is already an account is not queued but answers alike', async () => {
    const email = freshAddress();
    await seedEmailIdentity({ ownerId: await seedOwner(), email });
    const response = await join({ fields: { email, 'cf-turnstile-response': TURNSTILE_DUMMY_TOKEN }, settings: await fullSettings() });
    expect(await response.text()).toContain(escapedHtml(CLOUD_COPY.queuePage.queuedTitle));
    expect(await isQueued(email)).toBe(false);
  });

  test('a disposable address is not queued and the page asks to try again', async () => {
    const email = 'maria@mailinator.com';
    const response = await join({ fields: { email, 'cf-turnstile-response': TURNSTILE_DUMMY_TOKEN }, settings: await fullSettings() });
    expect(response.status).toBe(TOO_MANY_STATUS);
    expect(await isQueued(email)).toBe(false);
  });

  test('a cross-site post is forbidden and queues nobody', async () => {
    const email = freshAddress();
    const response = await join({
      fields: { email, 'cf-turnstile-response': TURNSTILE_DUMMY_TOKEN },
      settings: await fullSettings(),
      fetchSite: 'cross-site',
    });
    expect(response.status).toBe(FORBIDDEN_STATUS);
    expect(await isQueued(email)).toBe(false);
  });

  test('a post without a solved token queues nobody', async () => {
    const email = freshAddress();
    const response = await join({ fields: { email }, settings: await fullSettings() });
    expect(response.status).toBe(TOO_MANY_STATUS);
    expect(await isQueued(email)).toBe(false);
  });

  test('a malformed address asks to try again', async () => {
    const response = await join({
      fields: { email: 'not-an-address', 'cf-turnstile-response': TURNSTILE_DUMMY_TOKEN },
      settings: await fullSettings(),
    });
    expect(response.status).toBe(TOO_MANY_STATUS);
    expect(response.headers.get('Retry-After')).toBe('60');
  });

  test('without the Turnstile keys the line is closed', async () => {
    const email = freshAddress();
    const response = await join({
      fields: { email, 'cf-turnstile-response': TURNSTILE_DUMMY_TOKEN },
      settings: { ...(await fullSettings()), TURNSTILE_SECRET_KEY: undefined },
    });
    expect(response.status).toBe(UNAVAILABLE_STATUS);
    expect(await isQueued(email)).toBe(false);
  });
});
