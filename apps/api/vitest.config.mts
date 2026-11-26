import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { configDefaults, defineConfig } from 'vitest/config';

const SETTING_DEFAULTS_DIRECTORY = 'scripts/setting-defaults';
const STATEMENT_EXTENSION = '.sql';

function settingDefaultStatements(): Record<string, string> {
  const names = readdirSync(SETTING_DEFAULTS_DIRECTORY).filter((name) => name.endsWith(STATEMENT_EXTENSION));
  return Object.fromEntries(names.map((name) => [name, readFileSync(join(SETTING_DEFAULTS_DIRECTORY, name), 'utf8')]));
}

const LOADED_MACHINE_TEST_TIMEOUT_MS = 30_000;
const LOCAL_SITE_ORIGIN = 'http://localhost:8788';
const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA';
const TURNSTILE_TEST_SECRET_KEY = '1x0000000000000000000000000000000AA';
const SIGN_UP_TEST_KEY_SECRET = 'sign-up-key-secret-for-tests';
const TEST_SERVER_VERSION = '2026.11.25+0000000';
const NODE_TESTS = ['test/emails/**/*.test.ts', 'test/site/**/*.test.ts', 'test/server/**/*.test.ts', 'test/brand-asset.test.ts'];

export default defineConfig(async () => {
  const migrations = await readD1Migrations('migrations');
  return {
    test: {
      projects: [
        {
          define: { TODZ_SERVER_VERSION: JSON.stringify(TEST_SERVER_VERSION) },
          plugins: [
            cloudflareTest({
              wrangler: { configPath: './wrangler.jsonc' },
              miniflare: {
                d1Databases: ['MIGRATION_DIRECTORY'],
                bindings: {
                  MIGRATIONS: migrations,
                  SETTING_DEFAULT_STATEMENTS: settingDefaultStatements(),
                  SIGN_IN_PROVIDER: 'fake',
                  EMAIL_SENDER: 'console',
                  PUBLIC_ORIGIN: 'http://localhost:8787',
                  SITE_ORIGIN: LOCAL_SITE_ORIGIN,
                  TURNSTILE_SITE_KEY: TURNSTILE_TEST_SITE_KEY,
                  TURNSTILE_SECRET_KEY: TURNSTILE_TEST_SECRET_KEY,
                  SIGN_UP_KEY_SECRET: SIGN_UP_TEST_KEY_SECRET,
                },
              },
            }),
          ],
          test: {
            name: 'workers',
            include: ['test/**/*.test.ts'],
            exclude: [...configDefaults.exclude, ...NODE_TESTS],
            setupFiles: ['test/apply-migrations.ts'],
            testTimeout: LOADED_MACHINE_TEST_TIMEOUT_MS,
            hookTimeout: LOADED_MACHINE_TEST_TIMEOUT_MS,
          },
        },
        {
          test: {
            name: 'node',
            environment: 'node',
            include: NODE_TESTS,
            testTimeout: LOADED_MACHINE_TEST_TIMEOUT_MS,
            hookTimeout: LOADED_MACHINE_TEST_TIMEOUT_MS,
          },
        },
      ],
    },
  };
});
