import { exports } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { HttpStatus } from '../src/http-status';

const SITE_ORIGIN = 'http://localhost:8788';
const SERVER_ERROR_FLOOR = 500;
const ODD_DOWNLOAD_PATHS = [
  '/download/',
  '//download',
  '/download//latest',
  '/download/latest/',
  '/download/%2e/latest',
  '/download/latest/x',
  '/download/%2e%2e',
  '/download/%2fetc',
  '/download/%ZZ',
  '/download/%00',
  '/download/appcast.xml/x',
  '/download/9.9.9/Todz-9.9.9.dmg',
  '/download/0.2/x.dmg',
  '/download/latest?x',
  '/download/latest?%ZZ',
];
const METHODS = ['GET', 'HEAD', 'POST'];
const CASES = ODD_DOWNLOAD_PATHS.flatMap((path) => METHODS.map((method) => ({ path, method })));

describe('the Worker on odd download paths of the site host', () => {
  test.each(CASES)('$method $path never answers a server error', async ({ path, method }) => {
    const response = await exports.default.fetch(`${SITE_ORIGIN}${path}`, { method, redirect: 'manual' });
    expect(response.status).toBeLessThan(SERVER_ERROR_FLOOR);
  });

  test('a path that is not a staged file answers the site 404 with no body', async () => {
    const response = await exports.default.fetch(`${SITE_ORIGIN}/download/9.9.9/Todz-9.9.9.dmg`);
    expect(response.status).toBe(HttpStatus.NotFound);
    expect(await response.text()).toBe('');
  });
});
