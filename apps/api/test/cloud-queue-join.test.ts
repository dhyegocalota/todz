import { env } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { CLOUD_COPY } from '../src/cloud-copy';
import { countActiveAccounts, waitingAddresses } from '../src/cloud-queue-store';
import { TURNSTILE_DUMMY_TOKEN } from '../src/turnstile';
import { seedEmailIdentity, seedOwner } from './directory-seed';
import { CLIENT_ADDRESS_HEADER, CLIENT_ADDRESS, emailEnv, freshAddress, PUBLIC_ORIGIN } from './email-sign-in-client';
import { serveOwnerCall } from './owner-client';
import { CLOCK_NOW } from './task-fixtures';

const ACCEPTED_STATUS = 202;
const BAD_REQUEST_STATUS = 400;
const FORBIDDEN_STATUS = 403;

async function fullCloudSettings() {
  await seedOwner();
  const accounts = await countActiveAccounts({ directory: env.DIRECTORY, now: CLOCK_NOW });
  return emailEnv({ CLOUD_ACCOUNTS_MAX: String(accounts) });
}

function join({ email, workerEnv }: { email: unknown; workerEnv: ReturnType<typeof emailEnv> }): Promise<Response> {
  return serveOwnerCall({
    call: {
      method: 'POST',
      path: '/owner/cloud-queue',
      body: { email, turnstile_token: TURNSTILE_DUMMY_TOKEN },
      headers: { [CLIENT_ADDRESS_HEADER]: CLIENT_ADDRESS },
      origin: PUBLIC_ORIGIN,
    },
    now: CLOCK_NOW,
    workerEnv,
  });
}

async function isQueued(email: string): Promise<boolean> {
  const waiting = await waitingAddresses({ directory: env.DIRECTORY, limit: 1000 });
  return waiting.some((queued) => queued.email === email);
}

describe('leaving an address for the cloud queue', () => {
  test('a new address is queued when the cloud is full and the answer says so', async () => {
    const email = freshAddress();
    const response = await join({ email, workerEnv: await fullCloudSettings() });
    expect(response.status).toBe(ACCEPTED_STATUS);
    expect(await response.json()).toEqual({ message: CLOUD_COPY.queued });
    expect(await isQueued(email)).toBe(true);
  });

  test('an address already on the list answers alike and stays once', async () => {
    const email = freshAddress();
    const workerEnv = await fullCloudSettings();
    await join({ email, workerEnv });
    const response = await join({ email, workerEnv });
    expect(response.status).toBe(ACCEPTED_STATUS);
    const waiting = await waitingAddresses({ directory: env.DIRECTORY, limit: 1000 });
    expect(waiting.filter((queued) => queued.email === email)).toHaveLength(1);
  });

  test('an address that is already an account is not queued but answers alike', async () => {
    const email = freshAddress();
    await seedEmailIdentity({ ownerId: await seedOwner(), email });
    const response = await join({ email, workerEnv: await fullCloudSettings() });
    expect(response.status).toBe(ACCEPTED_STATUS);
    expect(await isQueued(email)).toBe(false);
  });

  test('an address is not queued while the cloud has room', async () => {
    const email = freshAddress();
    const response = await join({ email, workerEnv: emailEnv({ CLOUD_ACCOUNTS_MAX: '100000' }) });
    expect(response.status).toBe(ACCEPTED_STATUS);
    expect(await isQueued(email)).toBe(false);
  });

  test('a disposable address is refused and not queued', async () => {
    const email = 'maria@mailinator.com';
    const response = await join({ email, workerEnv: await fullCloudSettings() });
    expect(response.status).toBe(FORBIDDEN_STATUS);
    expect(await isQueued(email)).toBe(false);
  });

  test('a malformed address is a bad request', async () => {
    const response = await join({ email: 'not-an-address', workerEnv: await fullCloudSettings() });
    expect(response.status).toBe(BAD_REQUEST_STATUS);
  });
});
