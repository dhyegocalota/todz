import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium, defineConfig } from '@playwright/test';
import { ProjectName } from './e2e/project-name';

const SITE_PORT = 8791;
const INSPECTOR_PORT = 9291;
const SITE_ORIGIN = `http://localhost:${SITE_PORT}`;
const API_ORIGIN = 'http://localhost:8787';
const PERSIST_FOLDER_PREFIX = 'todz-e2e-';
const PERSIST_FOLDER_VARIABLE = 'TODZ_E2E_PERSIST_FOLDER';
const DATABASE_NAME = 'todz-directory';
const SERVER_START_TIMEOUT_MS = 120_000;
const TEST_TIMEOUT_MS = 30_000;
const ASSERTION_TIMEOUT_MS = 10_000;
const NAVIGATION_TIMEOUT_MS = 15_000;
const ACTION_TIMEOUT_MS = 10_000;
const SYSTEM_CHROME_CHANNEL = 'chrome';
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };
const MOBILE_VIEWPORT = { width: 375, height: 812 };

const SITE_VARIABLES: Record<string, string> = {
  SIGN_IN_PROVIDER: 'fake',
  EMAIL_SENDER: 'console',
  PUBLIC_ORIGIN: API_ORIGIN,
  SITE_ORIGIN: SITE_ORIGIN,
  TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
  TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
};

function persistFolder(): string {
  const existingFolder = process.env[PERSIST_FOLDER_VARIABLE];
  if (existingFolder !== undefined) return existingFolder;
  const createdFolder = fs.mkdtempSync(path.join(os.tmpdir(), PERSIST_FOLDER_PREFIX));
  process.env[PERSIST_FOLDER_VARIABLE] = createdFolder;
  return createdFolder;
}

function siteServerCommand(): string {
  const persistArgument = `--persist-to ${persistFolder()}`;
  const variableArguments = Object.entries(SITE_VARIABLES).map(([name, value]) => `--var ${name}:${value}`);
  const migrate = `pnpm exec wrangler d1 migrations apply ${DATABASE_NAME} --local ${persistArgument}`;
  const serve = [
    'pnpm exec wrangler dev',
    `--port ${SITE_PORT}`,
    `--inspector-port ${INSPECTOR_PORT}`,
    `--local-upstream localhost:${SITE_PORT}`,
    persistArgument,
    ...variableArguments,
  ].join(' ');
  return `${migrate} && ${serve}`;
}

function browserLaunch(): { channel?: string } {
  const isBundledChromiumInstalled = fs.existsSync(chromium.executablePath());
  if (isBundledChromiumInstalled) return {};
  return { channel: SYSTEM_CHROME_CHANNEL };
}

export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.spec.ts',
  timeout: TEST_TIMEOUT_MS,
  expect: { timeout: ASSERTION_TIMEOUT_MS },
  fullyParallel: true,
  forbidOnly: true,
  reporter: 'list',
  use: {
    baseURL: SITE_ORIGIN,
    navigationTimeout: NAVIGATION_TIMEOUT_MS,
    actionTimeout: ACTION_TIMEOUT_MS,
    ...browserLaunch(),
  },
  projects: [
    { name: ProjectName.Desktop, use: { viewport: DESKTOP_VIEWPORT } },
    { name: ProjectName.Mobile, use: { viewport: MOBILE_VIEWPORT } },
  ],
  webServer: {
    command: siteServerCommand(),
    url: SITE_ORIGIN,
    reuseExistingServer: false,
    timeout: SERVER_START_TIMEOUT_MS,
  },
});
