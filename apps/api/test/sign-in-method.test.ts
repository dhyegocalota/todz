import { describe, expect, test } from 'vitest';
import { ownerCall, serveOwnerCall, workerEnvWith } from './owner-client';
import { CLOCK_NOW } from './task-fixtures';

const OK_STATUS = 200;
const UNAVAILABLE_STATUS = 503;
const SIGN_IN_UNAVAILABLE = { error: 'sign_in_unavailable' };
const METHOD_PATH = '/owner/sign-in-method';
const LOCAL_ORIGIN = 'http://localhost:8787';

describe('GET /owner/sign-in-method', () => {
  test('answers link for the email provider', async () => {
    const response = await serveOwnerCall({
      call: { method: 'GET', path: METHOD_PATH },
      now: CLOCK_NOW,
      workerEnv: workerEnvWith({ SIGN_IN_PROVIDER: 'email', PUBLIC_ORIGIN: LOCAL_ORIGIN }),
    });
    expect(response.status).toBe(OK_STATUS);
    expect(await response.json()).toEqual({ method: 'link' });
  });

  test('answers identity for the fake provider, with no bearer', async () => {
    const response = await ownerCall({ method: 'GET', path: METHOD_PATH });
    expect(response.status).toBe(OK_STATUS);
    expect(await response.json()).toEqual({ method: 'identity' });
  });

  test.each([
    ['no provider configured', undefined],
    ['the provider apple', 'apple'],
  ])('%s answers 503 sign_in_unavailable', async (_name, provider) => {
    const response = await serveOwnerCall({
      call: { method: 'GET', path: METHOD_PATH },
      now: CLOCK_NOW,
      workerEnv: workerEnvWith({ SIGN_IN_PROVIDER: provider }),
    });
    expect(response.status).toBe(UNAVAILABLE_STATUS);
    expect(await response.json()).toEqual(SIGN_IN_UNAVAILABLE);
  });

  test.each([
    ['a public PUBLIC_ORIGIN', { SIGN_IN_PROVIDER: 'fake', PUBLIC_ORIGIN: 'https://api.todz.app' }, undefined],
    ['no PUBLIC_ORIGIN', { SIGN_IN_PROVIDER: 'fake' }, undefined],
    ['a public request host', { SIGN_IN_PROVIDER: 'fake', PUBLIC_ORIGIN: 'http://localhost:8787' }, 'https://api.todz.app'],
  ])('the fake provider with %s answers 503 sign_in_unavailable', async (_name, settings, origin) => {
    const response = await serveOwnerCall({
      call: { method: 'GET', path: METHOD_PATH, origin },
      now: CLOCK_NOW,
      workerEnv: workerEnvWith(settings),
    });
    expect(response.status).toBe(UNAVAILABLE_STATUS);
    expect(await response.json()).toEqual(SIGN_IN_UNAVAILABLE);
  });

  test('a stray bearer does not matter', async () => {
    const response = await ownerCall({ method: 'GET', path: METHOD_PATH, token: 'unknown' });
    expect(response.status).toBe(OK_STATUS);
  });
});
