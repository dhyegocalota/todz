import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium, defineConfig } from '@playwright/test';
import { REPOSITORY } from '@todz/types';
import { PERSIST_FOLDER_VARIABLE } from './e2e/persist-folder';
import { ProjectName } from './e2e/project-name';
import { FAKE_GITHUB_PORT } from './e2e/fake-github';
import { ADMIN_ADDRESS, SERVER_LOG_FILE_NAME } from './e2e/site-environment';

const SITE_PORT = 8791;
const INSPECTOR_PORT = 9291;
const SITE_ORIGIN = `http://localhost:${SITE_PORT}`;
const STAGED_SITE_PORT = 8792;
const STAGED_INSPECTOR_PORT = 9292;
const STAGED_SITE_ORIGIN = `http://localhost:${STAGED_SITE_PORT}`;
const STAGED_FOLDER_NAME = 'staged-assets';
const STAGED_STATE_FOLDER_NAME = 'staged-state';
const STAGED_SERVER_LOG_FILE_NAME = 'staged-server.log';
const STAGE_SCRIPT = 'e2e/stage-fixture-site.sh';
const API_ORIGIN = 'http://localhost:8787';
const FAKE_GITHUB_ORIGIN = `http://localhost:${FAKE_GITHUB_PORT}`;
const UNREACHABLE_GITHUB_ORIGIN = 'http://localhost:8794';
const FAKE_GITHUB_COMMAND = 'pnpm exec tsx e2e/fake-github.ts';
const PERSIST_FOLDER_PREFIX = 'todz-e2e-';
const DATABASE_NAME = 'todz-directory';
const SERVER_START_TIMEOUT_MS = 120_000;
const TEST_TIMEOUT_MS = 30_000;
const ASSERTION_TIMEOUT_MS = 10_000;
const NAVIGATION_TIMEOUT_MS = 15_000;
const ACTION_TIMEOUT_MS = 10_000;
const SYSTEM_CHROME_CHANNEL = 'chrome';
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };
const MOBILE_VIEWPORT = { width: 375, height: 812 };
const ADMIN_SPEC_PATTERN = /admin\.spec\.ts$/;

function siteVariablesOf({ siteOrigin, githubOrigin }: { siteOrigin: string; githubOrigin: string }): Record<string, string> {
  return {
    SIGN_IN_PROVIDER: 'fake',
    EMAIL_SENDER: 'console',
    PUBLIC_ORIGIN: API_ORIGIN,
    SITE_ORIGIN: siteOrigin,
    REPOSITORY_API_ORIGIN: githubOrigin,
    ADMIN_EMAIL: ADMIN_ADDRESS,
    TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
    TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
  };
}

function persistFolder(): string {
  const existingFolder = process.env[PERSIST_FOLDER_VARIABLE];
  if (existingFolder !== undefined) return existingFolder;
  const createdFolder = fs.mkdtempSync(path.join(os.tmpdir(), PERSIST_FOLDER_PREFIX));
  process.env[PERSIST_FOLDER_VARIABLE] = createdFolder;
  return createdFolder;
}

function siteServerCommand({
  port,
  inspectorPort,
  siteOrigin,
  githubOrigin,
  stateFolder,
  logFile,
  assetsArguments,
  beforeServing,
}: {
  port: number;
  inspectorPort: number;
  siteOrigin: string;
  githubOrigin: string;
  stateFolder: string;
  logFile: string;
  assetsArguments: string[];
  beforeServing: string[];
}): string {
  const persistArgument = `--persist-to ${stateFolder}`;
  const variableArguments = Object.entries(siteVariablesOf({ siteOrigin, githubOrigin })).map(([name, value]) => `--var ${name}:${value}`);
  const migrate = `pnpm exec wrangler d1 migrations apply ${DATABASE_NAME} --local ${persistArgument}`;
  const serve = [
    'pnpm exec wrangler dev',
    `--port ${port}`,
    `--inspector-port ${inspectorPort}`,
    `--local-upstream localhost:${port}`,
    persistArgument,
    ...assetsArguments,
    ...variableArguments,
  ].join(' ');
  return [...beforeServing, migrate, `${serve} > ${logFile} 2>&1`].join(' && ');
}

function defaultServerCommand(): string {
  return siteServerCommand({
    port: SITE_PORT,
    inspectorPort: INSPECTOR_PORT,
    siteOrigin: SITE_ORIGIN,
    githubOrigin: FAKE_GITHUB_ORIGIN,
    stateFolder: persistFolder(),
    logFile: path.join(persistFolder(), SERVER_LOG_FILE_NAME),
    assetsArguments: [],
    beforeServing: [],
  });
}

function stagedServerCommand(): string {
  const stagedFolder = path.join(persistFolder(), STAGED_FOLDER_NAME);
  return siteServerCommand({
    port: STAGED_SITE_PORT,
    inspectorPort: STAGED_INSPECTOR_PORT,
    siteOrigin: STAGED_SITE_ORIGIN,
    githubOrigin: UNREACHABLE_GITHUB_ORIGIN,
    stateFolder: path.join(persistFolder(), STAGED_STATE_FOLDER_NAME),
    logFile: path.join(persistFolder(), STAGED_SERVER_LOG_FILE_NAME),
    assetsArguments: [`--assets ${stagedFolder}`],
    beforeServing: [`bash ${STAGE_SCRIPT} ${stagedFolder}`],
  });
}

function browserLaunch(): { channel?: string } {
  const isBundledChromiumInstalled = fs.existsSync(chromium.executablePath());
  if (isBundledChromiumInstalled) return {};
  return { channel: SYSTEM_CHROME_CHANNEL };
}

export default defineConfig({
  globalTeardown: './e2e/global-teardown.ts',
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
    { name: ProjectName.Mobile, use: { viewport: MOBILE_VIEWPORT }, testIgnore: ADMIN_SPEC_PATTERN },
  ],
  webServer: [
    {
      command: FAKE_GITHUB_COMMAND,
      url: `${FAKE_GITHUB_ORIGIN}/repos/${REPOSITORY.path}`,
      reuseExistingServer: false,
      timeout: SERVER_START_TIMEOUT_MS,
    },
    { command: defaultServerCommand(), url: SITE_ORIGIN, reuseExistingServer: false, timeout: SERVER_START_TIMEOUT_MS },
    { command: stagedServerCommand(), url: STAGED_SITE_ORIGIN, reuseExistingServer: false, timeout: SERVER_START_TIMEOUT_MS },
  ],
});
