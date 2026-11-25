import { exports } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { serveHealth } from '../src/health';
import { HttpMethod } from '../src/http-method';
import { workerEnvWith } from './owner-client';

const API_ORIGIN = 'http://localhost:8787';
const SITE_ORIGIN = 'http://localhost:8788';
const UNKNOWN_ORIGIN = 'http://localhost:8799';
const HEALTH_BODY = { service: 'todz', origin: API_ORIGIN, version: '2026.11.25+0000000', minimum_app_version: '0.2.0' };
const OK_STATUS = 200;
const NOT_FOUND_STATUS = 404;

describe('GET /health', () => {
  test.each([
    { host: 'the API host', origin: API_ORIGIN },
    { host: 'the site host', origin: SITE_ORIGIN },
    { host: 'an unknown host', origin: UNKNOWN_ORIGIN },
  ])('answers the API origin on $host, as JSON that nothing may store', async ({ origin }) => {
    const response = await exports.default.fetch(`${origin}/health`);
    expect(response.status).toBe(OK_STATUS);
    expect(response.headers.get('Content-Type')).toContain('application/json');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual(HEALTH_BODY);
  });

  test('answers the same with a query string', async () => {
    const response = await exports.default.fetch(`${API_ORIGIN}/health?probe=1`);
    expect(response.status).toBe(OK_STATUS);
    expect(await response.json()).toEqual(HEALTH_BODY);
  });

  test('GET / on the API host still answers 404 with an empty body', async () => {
    const response = await exports.default.fetch(`${API_ORIGIN}/`);
    expect(response.status).toBe(NOT_FOUND_STATUS);
    expect(await response.text()).toBe('');
  });

  test('a trailing slash answers 404', async () => {
    const response = await exports.default.fetch(`${API_ORIGIN}/health/`);
    expect(response.status).toBe(NOT_FOUND_STATUS);
  });

  test('a configured origin with a trailing slash is not an origin, so it answers 404 with an empty body', async () => {
    const response = await serveHealth({
      request: new Request(`${API_ORIGIN}/health`),
      env: workerEnvWith({ PUBLIC_ORIGIN: `${API_ORIGIN}/` }),
    });
    expect(response.status).toBe(NOT_FOUND_STATUS);
    expect(await response.text()).toBe('');
  });

  test.each([API_ORIGIN, SITE_ORIGIN])('POST answers 404 on %s', async (origin) => {
    const response = await exports.default.fetch(`${origin}/health`, { method: 'POST' });
    expect(response.status).toBe(NOT_FOUND_STATUS);
    expect(await response.text()).toBe('');
  });
});

describe('HEAD /health', () => {
  test.each([
    { host: 'the API host', origin: API_ORIGIN },
    { host: 'the site host', origin: SITE_ORIGIN },
    { host: 'an unknown host', origin: UNKNOWN_ORIGIN },
  ])('answers 200 with the headers of GET and an empty body on $host', async ({ origin }) => {
    const response = await exports.default.fetch(`${origin}/health`, { method: 'HEAD' });
    expect(response.status).toBe(OK_STATUS);
    expect(response.headers.get('Content-Type')).toContain('application/json');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.text()).toBe('');
  });

  test('answers 200 with a query string', async () => {
    const response = await exports.default.fetch(`${API_ORIGIN}/health?probe=1`, { method: 'HEAD' });
    expect(response.status).toBe(OK_STATUS);
    expect(await response.text()).toBe('');
  });

  test('carries every header GET carries, with the same value', async () => {
    const getResponse = await exports.default.fetch(`${API_ORIGIN}/health`);
    const headResponse = await exports.default.fetch(`${API_ORIGIN}/health`, { method: 'HEAD' });
    const getHeaders = Object.fromEntries(getResponse.headers);
    const headHeaders = Object.fromEntries(headResponse.headers);
    expect(headHeaders).toEqual(getHeaders);
    expect(await getResponse.json()).toEqual(HEALTH_BODY);
  });

  test('HEAD on another path still answers 404 with an empty body', async () => {
    const response = await exports.default.fetch(`${API_ORIGIN}/`, { method: 'HEAD' });
    expect(response.status).toBe(NOT_FOUND_STATUS);
    expect(await response.text()).toBe('');
  });

  test('a configured origin with a trailing slash is not an origin, so it answers 404 with an empty body', async () => {
    const response = await serveHealth({
      request: new Request(`${API_ORIGIN}/health`, { method: 'HEAD' }),
      env: workerEnvWith({ PUBLIC_ORIGIN: `${API_ORIGIN}/` }),
    });
    expect(response.status).toBe(NOT_FOUND_STATUS);
    expect(await response.text()).toBe('');
  });
});

describe('other methods on /health', () => {
  test.each([API_ORIGIN, SITE_ORIGIN])('PUT answers 404 on %s', async (origin) => {
    const response = await exports.default.fetch(`${origin}/health`, { method: 'PUT' });
    expect(response.status).toBe(NOT_FOUND_STATUS);
    expect(await response.text()).toBe('');
  });

  test.each([API_ORIGIN, SITE_ORIGIN])('DELETE answers 404 on %s', async (origin) => {
    const response = await exports.default.fetch(`${origin}/health`, { method: 'DELETE' });
    expect(response.status).toBe(NOT_FOUND_STATUS);
    expect(await response.text()).toBe('');
  });

  test.each([API_ORIGIN, SITE_ORIGIN])('PATCH answers 404 on %s', async (origin) => {
    const response = await exports.default.fetch(`${origin}/health`, { method: HttpMethod.Patch });
    expect(response.status).toBe(NOT_FOUND_STATUS);
    expect(await response.text()).toBe('');
  });
});
