import fs from 'node:fs';
import { chromium, defineConfig } from '@playwright/test';
import { docsPortOf } from './e2e/support/docs-port';
import { DocsViewport } from './e2e/support/docs-walk';

const SERVER_TIMEOUT_MS = 120_000;
const TEST_TIMEOUT_MS = 60_000;
const ASSERTION_TIMEOUT_MS = 15_000;
const NAVIGATION_TIMEOUT_MS = 30_000;
const ACTION_TIMEOUT_MS = 15_000;
const SYSTEM_CHROME_CHANNEL = 'chrome';
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };
const NARROW_VIEWPORT = { width: 375, height: 812 };
const IGNORED_SPECS_PATTERN = /\/_[^/]*\.spec\.ts$/;
const docsPort = await docsPortOf();

function browserLaunch(): { channel?: string } {
  const isBundledChromiumInstalled = fs.existsSync(chromium.executablePath());
  if (isBundledChromiumInstalled) return {};
  return { channel: SYSTEM_CHROME_CHANNEL };
}

export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.spec.ts',
  testIgnore: IGNORED_SPECS_PATTERN,
  timeout: TEST_TIMEOUT_MS,
  expect: { timeout: ASSERTION_TIMEOUT_MS },
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${docsPort}`,
    navigationTimeout: NAVIGATION_TIMEOUT_MS,
    actionTimeout: ACTION_TIMEOUT_MS,
    ...browserLaunch(),
  },
  projects: [
    { name: DocsViewport.Desktop, use: { viewport: DESKTOP_VIEWPORT } },
    { name: DocsViewport.Narrow, use: { viewport: NARROW_VIEWPORT } },
  ],
  webServer: {
    command: `pnpm run dev --port ${docsPort} --no-open`,
    url: `http://localhost:${docsPort}`,
    reuseExistingServer: false,
    timeout: SERVER_TIMEOUT_MS,
  },
});
