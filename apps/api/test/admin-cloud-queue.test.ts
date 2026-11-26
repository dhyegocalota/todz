import { createExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { CLOUD_COPY } from '../src/cloud-copy';
import { countActiveAccounts, enqueueAddress, isAdmittedAddress, waitingAddresses } from '../src/cloud-queue-store';
import { digestCredential } from '../src/credential-digest';
import type { Env } from '../src/env';
import { serveAdminCloudAdmissions } from '../src/site/admin-cloud-admissions';
import { serveAdminCloudQueue } from '../src/site/admin-cloud-queue';
import { AdminCookie } from '../src/site/admin-session';
import { seedEmailIdentity, seedOwner } from './directory-seed';
import { freshAddress, recordingBinding } from './email-sign-in-client';
import type { SentMessage } from './email-sign-in-client';

const ADMIN_EMAIL = 'owner@todz.test';
const SITE_ORIGIN = 'http://localhost:8788';
const SESSION_LIFETIME_MS = 60 * 60 * 1000;
const SEE_OTHER_STATUS = 303;
const FORBIDDEN_STATUS = 403;
const NOW = Date.now();

function adminEnv(settings: Partial<Env> = {}): Env {
  return { ...env, ADMIN_EMAIL, SITE_ORIGIN, PUBLIC_ORIGIN: 'https://todz.app', EMAIL_SENDER: 'cloudflare', ...settings };
}

async function sessionCookie(): Promise<string> {
  const secret = crypto.randomUUID();
  await env.DIRECTORY.prepare('INSERT INTO admin_sessions (digest, email, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await digestCredential(secret), ADMIN_EMAIL, NOW, NOW + SESSION_LIFETIME_MS)
    .run();
  return `${AdminCookie.Session}=${secret}`;
}

function admissionRequest({ cookie, fetchSite, body }: { cookie: string | null; fetchSite: string; body: URLSearchParams }): Request {
  const headers: Record<string, string> = { 'Sec-Fetch-Site': fetchSite, 'Content-Type': 'application/x-www-form-urlencoded' };
  if (cookie !== null) headers.Cookie = cookie;
  return new Request(`${SITE_ORIGIN}/admin/cloud-queue/admissions`, { method: 'POST', headers, body });
}

async function admit({ body, settings }: { body: URLSearchParams; settings: Partial<Env> }): Promise<Response> {
  return serveAdminCloudAdmissions({
    request: admissionRequest({ cookie: await sessionCookie(), fetchSite: 'same-origin', body }),
    env: adminEnv(settings),
    executionContext: createExecutionContext(),
  });
}

function invitesOf(sent: SentMessage[]): string[] {
  return sent.filter((message) => message.subject === CLOUD_COPY.invite.subject).map((message) => message.to);
}

describe('the admin cloud queue', () => {
  test('without a session it lists nobody', async () => {
    const email = freshAddress();
    await enqueueAddress({ directory: env.DIRECTORY, email, now: NOW });
    const response = await serveAdminCloudQueue({
      request: new Request(`${SITE_ORIGIN}/admin/cloud-queue`),
      env: adminEnv(),
      executionContext: createExecutionContext(),
    });
    expect(await response.text()).not.toContain(email);
  });

  test('a signed-in admin sees the waiting addresses with an Admit button', async () => {
    const email = freshAddress();
    await enqueueAddress({ directory: env.DIRECTORY, email, now: NOW });
    const response = await serveAdminCloudQueue({
      request: new Request(`${SITE_ORIGIN}/admin/cloud-queue`, { headers: { Cookie: await sessionCookie() } }),
      env: adminEnv(),
      executionContext: createExecutionContext(),
    });
    const page = await response.text();
    expect(page).toContain(email);
    expect(page).toContain('Admit next');
  });

  async function queuePageWith(settings: Partial<Env>): Promise<string> {
    const response = await serveAdminCloudQueue({
      request: new Request(`${SITE_ORIGIN}/admin/cloud-queue`, { headers: { Cookie: await sessionCookie() } }),
      env: adminEnv(settings),
      executionContext: createExecutionContext(),
    });
    return response.text();
  }

  test('with the cap on and no analytics token the page says the guard is estimate only', async () => {
    expect(await queuePageWith({ CLOUD_ACCOUNTS_MAX: '50' })).toContain('budget guard: estimate only');
  });

  test('with the cap on and the token set the page says nothing of it', async () => {
    expect(await queuePageWith({ CLOUD_ACCOUNTS_MAX: '50', CLOUDFLARE_ANALYTICS_TOKEN: 'token-for-tests' })).not.toContain('estimate only');
  });

  test('with the cap off nothing warns', async () => {
    expect(await queuePageWith({})).not.toContain('estimate only');
  });

  test('Admit one admits the address and mails the invite', async () => {
    const { binding, sent } = recordingBinding();
    const email = freshAddress();
    await enqueueAddress({ directory: env.DIRECTORY, email, now: NOW });
    const response = await admit({ body: new URLSearchParams({ email }), settings: { EMAIL: binding } });
    expect(response.status).toBe(SEE_OTHER_STATUS);
    expect(await isAdmittedAddress({ directory: env.DIRECTORY, email, now: NOW })).toBe(true);
    expect(invitesOf(sent)).toEqual([email]);
  });

  test('Admit next N admits the oldest N and mails each', async () => {
    await env.DIRECTORY.prepare('DELETE FROM cloud_queue').run();
    const { binding, sent } = recordingBinding();
    const [first, second, third] = [freshAddress(), freshAddress(), freshAddress()];
    await enqueueAddress({ directory: env.DIRECTORY, email: first, now: NOW });
    await enqueueAddress({ directory: env.DIRECTORY, email: second, now: NOW + 1 });
    await enqueueAddress({ directory: env.DIRECTORY, email: third, now: NOW + 2 });
    await admit({ body: new URLSearchParams({ count: '2' }), settings: { EMAIL: binding } });
    expect([...invitesOf(sent)].sort()).toEqual([first, second].sort());
    expect((await waitingAddresses({ directory: env.DIRECTORY, limit: 10 })).map((queued) => queued.email)).toEqual([third]);
  });

  test('Admit next N admits no more than the free spots and the next ask finds none left', async () => {
    await env.DIRECTORY.prepare('DELETE FROM cloud_queue').run();
    const { binding, sent } = recordingBinding();
    const accounts = await countActiveAccounts({ directory: env.DIRECTORY, now: NOW });
    const settings = { EMAIL: binding, CLOUD_ACCOUNTS_MAX: String(accounts + 2) };
    const waiting = [freshAddress(), freshAddress(), freshAddress(), freshAddress()];
    await Promise.all(waiting.map((email, index) => enqueueAddress({ directory: env.DIRECTORY, email, now: NOW + index })));
    await admit({ body: new URLSearchParams({ count: '4' }), settings });
    expect([...invitesOf(sent)].sort()).toEqual(waiting.slice(0, 2).sort());
    await admit({ body: new URLSearchParams({ count: '4' }), settings });
    expect(invitesOf(sent)).toHaveLength(2);
    expect(await waitingAddresses({ directory: env.DIRECTORY, limit: 10 })).toHaveLength(2);
  });

  test('an admitted address that signed in holds its spot as an account, not as an admission', async () => {
    await env.DIRECTORY.prepare('DELETE FROM cloud_queue').run();
    const { binding, sent } = recordingBinding();
    const signedInEmail = freshAddress();
    await enqueueAddress({ directory: env.DIRECTORY, email: signedInEmail, now: NOW });
    await admit({ body: new URLSearchParams({ email: signedInEmail }), settings: { EMAIL: binding } });
    await seedEmailIdentity({ ownerId: await seedOwner(), email: signedInEmail });
    const waiting = [freshAddress(), freshAddress()];
    await Promise.all(waiting.map((email, index) => enqueueAddress({ directory: env.DIRECTORY, email, now: NOW + index })));
    const accounts = await countActiveAccounts({ directory: env.DIRECTORY, now: NOW });
    await admit({ body: new URLSearchParams({ count: '2' }), settings: { EMAIL: binding, CLOUD_ACCOUNTS_MAX: String(accounts + 1) } });
    expect(invitesOf(sent).filter((address) => waiting.includes(address))).toHaveLength(1);
  });

  test('Admit next N with no free spot admits nobody and mails nobody', async () => {
    await env.DIRECTORY.prepare('DELETE FROM cloud_queue').run();
    const { binding, sent } = recordingBinding();
    const accounts = await countActiveAccounts({ directory: env.DIRECTORY, now: NOW });
    const email = freshAddress();
    await enqueueAddress({ directory: env.DIRECTORY, email, now: NOW });
    await admit({ body: new URLSearchParams({ count: '3' }), settings: { EMAIL: binding, CLOUD_ACCOUNTS_MAX: String(accounts) } });
    expect(sent).toEqual([]);
    expect(await isAdmittedAddress({ directory: env.DIRECTORY, email, now: NOW })).toBe(false);
  });

  test('a cross-site post is forbidden and admits nobody', async () => {
    const { binding, sent } = recordingBinding();
    const email = freshAddress();
    await enqueueAddress({ directory: env.DIRECTORY, email, now: NOW });
    const response = await serveAdminCloudAdmissions({
      request: admissionRequest({ cookie: await sessionCookie(), fetchSite: 'cross-site', body: new URLSearchParams({ email }) }),
      env: adminEnv({ EMAIL: binding }),
      executionContext: createExecutionContext(),
    });
    expect(response.status).toBe(FORBIDDEN_STATUS);
    expect(await isAdmittedAddress({ directory: env.DIRECTORY, email, now: NOW })).toBe(false);
    expect(sent).toEqual([]);
  });

  test('a post without a session admits nobody', async () => {
    const email = freshAddress();
    await enqueueAddress({ directory: env.DIRECTORY, email, now: NOW });
    await serveAdminCloudAdmissions({
      request: admissionRequest({ cookie: null, fetchSite: 'same-origin', body: new URLSearchParams({ email }) }),
      env: adminEnv(),
      executionContext: createExecutionContext(),
    });
    expect(await isAdmittedAddress({ directory: env.DIRECTORY, email, now: NOW })).toBe(false);
  });
});
