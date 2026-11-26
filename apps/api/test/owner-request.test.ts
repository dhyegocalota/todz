import { APP_VERSION_HEADER, MINIMUM_APP_VERSION } from '@todz/types';
import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { Env } from '../src/env';
import { serveOwner } from '../src/owner-endpoint';
import { OWNER_BODY_LENGTH_MAX } from '../src/request-body';
import { CLIENT_ADDRESS, CLIENT_ADDRESS_HEADER, LINK_CHALLENGE, acceptingSiteverify, emailEnv, freshAddress } from './email-sign-in-client';
import { ownerCall, serveOwnerCall, signInOwner } from './owner-client';
import { CLOCK_NOW } from './task-fixtures';

const BAD_REQUEST_STATUS = 400;
const CREATED_STATUS = 201;
const INVALID_REQUEST = { error: 'invalid_request' };
const BODY_LENGTH_MAX = 4096;
const OVERSIZED_LENGTH = BODY_LENGTH_MAX + 1;
const SIGNED_IN_BODY_LENGTH_MAX = OWNER_BODY_LENGTH_MAX;
const SIGNED_IN_OVERSIZED_LENGTH = SIGNED_IN_BODY_LENGTH_MAX + 1;
const JSON_MEDIA_TYPE = 'application/json';
const LOCAL_ORIGIN = 'http://localhost:8787';

type CountRow = { total: number };

function paddedName(length: number): string {
  const frame = JSON.stringify({ name: 'Work', padding: '' });
  return JSON.stringify({ name: 'Work', padding: 'a'.repeat(length - frame.length) });
}

function linkBody(length: number): string {
  const fields = { email: freshAddress(), link_challenge: LINK_CHALLENGE, turnstile_token: 'token', app_link_scheme: 'todz', padding: '' };
  const frame = JSON.stringify(fields);
  return JSON.stringify({ ...fields, padding: 'a'.repeat(length - frame.length) });
}

async function workspaceCount(ownerId: string): Promise<number> {
  const row = await env.DIRECTORY.prepare('SELECT count(*) AS total FROM workspaces WHERE owner_id = ?').bind(ownerId).first<CountRow>();
  if (row === null) throw new Error('count always answers a row');
  return row.total;
}

function streamedRequest({ path, headers, body }: { path: string; headers: Record<string, string>; body: string }): Request {
  return new Request(`${LOCAL_ORIGIN}${path}`, {
    method: 'POST',
    headers: { [APP_VERSION_HEADER]: MINIMUM_APP_VERSION, 'Content-Type': JSON_MEDIA_TYPE, ...headers },
    body: new Blob([body]).stream(),
  });
}

async function serveStreamed({ request, workerEnv = env }: { request: Request; workerEnv?: Env }): Promise<Response> {
  const executionContext = createExecutionContext();
  const response = await serveOwner({ request, env: workerEnv, now: CLOCK_NOW, executionContext });
  await waitOnExecutionContext(executionContext);
  return response;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('a signed-in body', () => {
  test('of exactly the bound is read (pin)', async () => {
    const { token } = await signInOwner();
    const body = paddedName(SIGNED_IN_BODY_LENGTH_MAX);
    expect(body).toHaveLength(SIGNED_IN_BODY_LENGTH_MAX);
    const response = await ownerCall({ method: 'POST', path: '/owner/workspaces', token, rawBody: body });
    expect(response.status).toBe(CREATED_STATUS);
  });

  test('over the bound is refused and keeps nothing', async () => {
    const { token, ownerId } = await signInOwner();
    const response = await ownerCall({ method: 'POST', path: '/owner/workspaces', token, rawBody: paddedName(SIGNED_IN_OVERSIZED_LENGTH) });
    expect(response.status).toBe(BAD_REQUEST_STATUS);
    expect(await response.json()).toEqual(INVALID_REQUEST);
    expect(await workspaceCount(ownerId)).toBe(0);
  });

  test('without a length is refused and keeps nothing', async () => {
    const { token, ownerId } = await signInOwner();
    const request = streamedRequest({
      path: '/owner/workspaces',
      headers: { Authorization: `Bearer ${token}` },
      body: paddedName(SIGNED_IN_BODY_LENGTH_MAX),
    });
    const response = await serveStreamed({ request });
    expect(response.status).toBe(BAD_REQUEST_STATUS);
    expect(await workspaceCount(ownerId)).toBe(0);
  });
});

describe('a public body', () => {
  test('over the bound is refused before Turnstile', async () => {
    const siteverify = acceptingSiteverify();
    const response = await serveOwnerCall({
      call: {
        method: 'POST',
        path: '/owner/sign-in-links',
        rawBody: linkBody(OVERSIZED_LENGTH),
        headers: { [CLIENT_ADDRESS_HEADER]: CLIENT_ADDRESS },
      },
      now: CLOCK_NOW,
      workerEnv: emailEnv(),
    });
    expect(response.status).toBe(BAD_REQUEST_STATUS);
    expect(await response.json()).toEqual(INVALID_REQUEST);
    expect(siteverify).not.toHaveBeenCalled();
  });

  test('without a length is refused before Turnstile', async () => {
    const siteverify = acceptingSiteverify();
    const request = streamedRequest({
      path: '/owner/sign-in-links',
      headers: { [CLIENT_ADDRESS_HEADER]: CLIENT_ADDRESS },
      body: linkBody(BODY_LENGTH_MAX),
    });
    const response = await serveStreamed({ request, workerEnv: emailEnv() });
    expect(response.status).toBe(BAD_REQUEST_STATUS);
    expect(siteverify).not.toHaveBeenCalled();
  });
});
