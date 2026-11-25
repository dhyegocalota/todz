import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { configDefaults, defineConfig } from 'vitest/config';

const LOADED_MACHINE_TEST_TIMEOUT_MS = 30_000;
const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA';
const TURNSTILE_TEST_SECRET_KEY = '1x0000000000000000000000000000000AA';
const NODE_TESTS = ['test/emails/**/*.test.ts', 'test/site/**/*.test.ts', 'test/brand-asset.test.ts'];

export default defineConfig(async () => {
  const migrations = await readD1Migrations('migrations');
  return {
    test: {
      projects: [
        {
          plugins: [
            cloudflareTest({
              wrangler: { configPath: './wrangler.jsonc' },
              miniflare: {
                bindings: {
                  MIGRATIONS: migrations,
                  SIGN_IN_PROVIDER: 'fake',
                  EMAIL_SENDER: 'console',
                  PUBLIC_ORIGIN: 'http://localhost:8787',
                  TURNSTILE_SITE_KEY: TURNSTILE_TEST_SITE_KEY,
                  TURNSTILE_SECRET_KEY: TURNSTILE_TEST_SECRET_KEY,
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
