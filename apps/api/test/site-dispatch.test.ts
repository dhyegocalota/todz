import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, expect, test } from 'vitest';
import worker from '../src/index';
import { workerEnvWith } from './owner-client';

const API_ORIGIN = 'https://api.todz.app';
const SITE_ORIGIN = 'https://todz.app';
const WWW_ORIGIN = 'https://www.todz.app';
const OK_STATUS = 200;
const MOVED_PERMANENTLY_STATUS = 301;
const SEE_OTHER_STATUS = 303;
const NOT_FOUND_STATUS = 404;
const UNAVAILABLE_STATUS = 503;
const SCRIPT_PAYLOAD = '<script>alert(1)</script>';
const FORM_BODY = `email=${SCRIPT_PAYLOAD}`;
const FORM_CONTENT_TYPE = 'application/x-www-form-urlencoded';
const PRODUCTION_SETTINGS = { PUBLIC_ORIGIN: API_ORIGIN, SITE_ORIGIN, SIGN_IN_PROVIDER: 'fake' };

type EdgeRequest = Request<unknown, IncomingRequestCfProperties>;

async function serve(request: Request): Promise<Response> {
  const executionContext = createExecutionContext();
  const response = await worker.fetch(request as EdgeRequest, workerEnvWith(PRODUCTION_SETTINGS), executionContext);
  await waitOnExecutionContext(executionContext);
  return response;
}

function requestOf({ url, method = 'GET' }: { url: string; method?: string }): Request {
  return new Request(url, { method, redirect: 'manual' });
}

describe('the site host', () => {
  test.each([
    ['GET', '/'],
    ['HEAD', '/'],
    ['GET', '/self-host'],
    ['HEAD', '/self-host'],
  ])('%s %s answers 200', async (method, path) => {
    const response = await serve(requestOf({ url: `${SITE_ORIGIN}${path}`, method }));
    expect(response.status).toBe(OK_STATUS);
  });

  test.each([
    ['GET', '/owner/sign-in-method'],
    ['GET', '/mcp'],
    ['GET', '/sign-in'],
    ['GET', '/sign-in/challenge'],
    ['GET', '/self-host/'],
    ['POST', '/'],
    ['POST', '/self-host'],
    ['GET', '/unknown'],
  ])('%s %s answers 404', async (method, path) => {
    const response = await serve(requestOf({ url: `${SITE_ORIGIN}${path}`, method }));
    expect(response.status).toBe(NOT_FOUND_STATUS);
    expect(await response.text()).toBe('');
  });

  test('GET /join answers 303 to the landing', async () => {
    const response = await serve(requestOf({ url: `${SITE_ORIGIN}/join` }));
    expect(response.status).toBe(SEE_OTHER_STATUS);
    expect(response.headers.get('Location')).toBe('/');
  });

  test('POST /join answers 200, never echoes the body and never reads it', async () => {
    const request = new Request(`${SITE_ORIGIN}/join`, {
      method: 'POST',
      headers: { 'Content-Type': FORM_CONTENT_TYPE },
      body: FORM_BODY,
    });
    const response = await serve(request);
    expect(response.status).toBe(OK_STATUS);
    expect(await response.text()).not.toContain(SCRIPT_PAYLOAD);
    expect(request.bodyUsed).toBe(false);
  });
});

describe('the API host', () => {
  test.each(['/', '/self-host'])('GET %s answers 404', async (path) => {
    const response = await serve(requestOf({ url: `${API_ORIGIN}${path}` }));
    expect(response.status).toBe(NOT_FOUND_STATUS);
  });

  test('GET /owner/sign-in-method answers as it did before the site', async () => {
    const response = await serve(requestOf({ url: `${API_ORIGIN}/owner/sign-in-method` }));
    expect(response.status).toBe(UNAVAILABLE_STATUS);
  });
});

describe('the www host', () => {
  test('answers 301 to the site host with the path and the query', async () => {
    const response = await serve(requestOf({ url: `${WWW_ORIGIN}/self-host?ref=x` }));
    expect(response.status).toBe(MOVED_PERMANENTLY_STATUS);
    expect(response.headers.get('Location')).toBe(`${SITE_ORIGIN}/self-host?ref=x`);
  });
});

describe('an unknown host', () => {
  test.each(['https://todz-api.example.workers.dev/', 'https://203.0.113.7/self-host', 'https://evil.todz.app/'])(
    '%s answers 404',
    async (url) => {
      const response = await serve(requestOf({ url }));
      expect(response.status).toBe(NOT_FOUND_STATUS);
    },
  );
});
