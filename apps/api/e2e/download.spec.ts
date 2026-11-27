import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type APIResponse, expect, test } from '@playwright/test';
import { LANDING_COPY } from '../src/site/landing-copy';

enum ColorScheme {
  Light = 'light',
  Dark = 'dark',
}

const STAGED_SITE_ORIGIN = 'http://localhost:8792';
const FIXTURE_DOWNLOADS = fileURLToPath(new URL('fixtures/release/site/download', import.meta.url));
const LATEST_VERSION = '0.0.2';
const PREVIOUS_VERSION = '0.0.1';
const LATEST_DISK_IMAGE_PATH = `/download/${LATEST_VERSION}/Todz-${LATEST_VERSION}.dmg`;
const FOUND_STATUS = 302;
const OK_STATUS = 200;
const NOT_FOUND_STATUS = 404;
const STRICT_TRANSPORT_SECURITY = 'max-age=31536000; includeSubDomains';
const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';
const APPCAST_CACHE_CONTROL = 'public, max-age=300';
const TEXT_CONTENT_TYPE = 'text/plain; charset=utf-8';
const NO_ROUTE_PATH = '/no-such-page';
const INSTALL_STEPS_URL = 'https://docs.todz.app/install-on-mac';
const ODD_METHODS = ['GET', 'HEAD'];
const ODD_DOWNLOAD_PATHS = [
  '/download/',
  '/download//latest',
  '/download/latest/',
  '/download/latest.',
  '/download/Latest',
  '/download/%ZZ',
  '/download/%00',
  '/download/%2fetc',
  '/download/%2e/latest',
  '/download/appcast.xml/',
  '/download/appcast.xml/x',
  `/download/${LATEST_VERSION}/`,
  `/download/${LATEST_VERSION}`,
  `${LATEST_DISK_IMAGE_PATH}/`,
  `${LATEST_DISK_IMAGE_PATH}%00`,
  '/download/9.9.9/Todz-9.9.9.dmg',
  '/download?x=1',
  '/download/latest?a=%ZZ',
];
const RELEASE_LOCATION_PATTERN = /^\/download\/\d+\.\d+\.\d+\/Todz-\d+\.\d+\.\d+\.dmg(\?.*)?$/;
const COLOR_SCHEMES = [ColorScheme.Light, ColorScheme.Dark];
const DOWNLOAD_BUTTON = '.hero .download-button';
const DOWNLOAD_NOTE = '.hero .download-note';

test.use({ baseURL: STAGED_SITE_ORIGIN });

function fixtureBytes({ version, name }: { version: string; name: string }): Buffer {
  return fs.readFileSync(path.join(FIXTURE_DOWNLOADS, version, name));
}

function disposition(version: string): string {
  return `attachment; filename="Todz-${version}.dmg"`;
}

async function assertSecurityHeaders(response: APIResponse): Promise<void> {
  expect(response.headers()['x-content-type-options']).toBe('nosniff');
  expect(response.headers()['strict-transport-security']).toBe(STRICT_TRANSPORT_SECURITY);
}

test.describe('the staged downloads', () => {
  for (const downloadPath of ['/download', '/download/latest']) {
    test(`${downloadPath} redirects to the latest disk image and nothing else`, async ({ request }) => {
      const response = await request.get(downloadPath, { maxRedirects: 0 });
      expect(response.status()).toBe(FOUND_STATUS);
      expect(response.headers()['location']).toBe(LATEST_DISK_IMAGE_PATH);
      await assertSecurityHeaders(response);
      expect(response.headers()['referrer-policy']).toBe('no-referrer');
      expect(response.headers()['cache-control']).toBeUndefined();
      expect(response.headers()['content-disposition']).toBeUndefined();
    });
  }

  test('the latest disk image is an attachment named with its version, cached for good, with the fixture bytes', async ({ request }) => {
    const response = await request.get(LATEST_DISK_IMAGE_PATH);
    expect(response.status()).toBe(OK_STATUS);
    expect(response.headers()['content-disposition']).toBe(disposition(LATEST_VERSION));
    expect(response.headers()['cache-control']).toBe(IMMUTABLE_CACHE_CONTROL);
    await assertSecurityHeaders(response);
    expect(await response.body()).toEqual(fixtureBytes({ version: LATEST_VERSION, name: `Todz-${LATEST_VERSION}.dmg` }));
  });

  test('the previous disk image still downloads under its own name', async ({ request }) => {
    const response = await request.get(`/download/${PREVIOUS_VERSION}/Todz-${PREVIOUS_VERSION}.dmg`);
    expect(response.status()).toBe(OK_STATUS);
    expect(response.headers()['content-disposition']).toBe(disposition(PREVIOUS_VERSION));
    expect(await response.body()).toEqual(fixtureBytes({ version: PREVIOUS_VERSION, name: `Todz-${PREVIOUS_VERSION}.dmg` }));
  });

  for (const suffix of ['sha256', 'sig']) {
    test(`the .${suffix} is plain text, cached for good and the fixture's own`, async ({ request }) => {
      const response = await request.get(`${LATEST_DISK_IMAGE_PATH}.${suffix}`);
      expect(response.status()).toBe(OK_STATUS);
      expect(response.headers()['content-type']).toBe(TEXT_CONTENT_TYPE);
      expect(response.headers()['cache-control']).toBe(IMMUTABLE_CACHE_CONTROL);
      await assertSecurityHeaders(response);
      expect(await response.body()).toEqual(fixtureBytes({ version: LATEST_VERSION, name: `Todz-${LATEST_VERSION}.dmg.${suffix}` }));
    });
  }

  test('the appcast is the latest version, cached for five minutes', async ({ request }) => {
    const response = await request.get('/download/appcast.xml');
    expect(response.status()).toBe(OK_STATUS);
    expect(response.headers()['cache-control']).toBe(APPCAST_CACHE_CONTROL);
    expect(response.headers()['content-type']).toContain('application/xml');
    expect(await response.body()).toEqual(fixtureBytes({ version: LATEST_VERSION, name: 'appcast.xml' }));
  });

  test('the answer of an unknown route is the site 404, and so are a malformed version, a stray file and an unstaged version', async ({
    request,
  }) => {
    const noRoute = await request.get(NO_ROUTE_PATH);
    expect(noRoute.status()).toBe(NOT_FOUND_STATUS);
    const noRouteBody = await noRoute.text();
    for (const missingPath of [
      '/download/0.2/x.dmg',
      `/download/${LATEST_VERSION}/notes.txt`,
      '/download/9.9.9/Todz-9.9.9.dmg',
      '/download/nothing',
    ]) {
      const response = await request.get(missingPath, { maxRedirects: 0 });
      expect(response.status(), missingPath).toBe(NOT_FOUND_STATUS);
      expect(await response.text(), missingPath).toBe(noRouteBody);
    }
  });

  for (const method of ODD_METHODS) {
    for (const oddPath of ODD_DOWNLOAD_PATHS) {
      test(`${method} ${oddPath} answers a 404 or a redirect to a release and never a server error`, async ({ request }) => {
        const response = await request.fetch(oddPath, { method, maxRedirects: 0 });
        expect([NOT_FOUND_STATUS, FOUND_STATUS]).toContain(response.status());
        if (response.status() === FOUND_STATUS) expect(response.headers()['location']).toMatch(RELEASE_LOCATION_PATTERN);
      });
    }
  }

  test('the headers and redirects files are not served', async ({ request }) => {
    for (const hiddenPath of ['/_headers', '/_redirects']) {
      const response = await request.get(hiddenPath, { maxRedirects: 0 });
      expect(response.status(), hiddenPath).toBe(NOT_FOUND_STATUS);
    }
  });

  test('the Worker still answers /health and /sign-in first', async ({ request }) => {
    const health = await request.get('/health');
    expect(health.status()).toBe(OK_STATUS);
    expect((await health.json()).service).toBe('todz');
    const signIn = await request.get('/sign-in', { maxRedirects: 0 });
    expect(signIn.headers()['content-security-policy']).toBeTruthy();
  });
});

test.describe('the landing with a released version', () => {
  for (const colorScheme of COLOR_SCHEMES) {
    test(`in ${colorScheme}, shows the button and the note and no form without scrolling sideways`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto('/');
      const button = page.locator(DOWNLOAD_BUTTON);
      await expect(button).toBeVisible();
      await expect(button).toHaveText(LANDING_COPY.download.heroButton);
      await expect(page.locator(DOWNLOAD_NOTE)).toContainText(LANDING_COPY.download.note);
      await expect(page.locator(`${DOWNLOAD_NOTE} a`)).toHaveAttribute('href', INSTALL_STEPS_URL);
      await expect(page.locator('.hero .eyebrow-pill')).toHaveText(LANDING_COPY.hero.eyebrow);
      await expect(page.locator('form:not(.language-form):not(.theme-form)')).toHaveCount(0);
      const hasSidewaysScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(hasSidewaysScroll).toBe(false);
    });
  }

  test('a click downloads the latest disk image under its versioned name', async ({ page }) => {
    await page.goto('/');
    const downloadPromise = page.waitForEvent('download');
    await page.locator(DOWNLOAD_BUTTON).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(`Todz-${LATEST_VERSION}.dmg`);
  });
});
