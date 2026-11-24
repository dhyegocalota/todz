import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { configDefaults, defineConfig } from 'vitest/config';

const LOADED_MACHINE_TEST_TIMEOUT_MS = 30_000;
const NODE_TESTS = ['test/emails/**/*.test.ts', 'test/brand-asset.test.ts'];

export default defineConfig(async () => {
  const migrations = await readD1Migrations('migrations');
  const timeouts = { testTimeout: LOADED_MACHINE_TEST_TIMEOUT_MS, hookTimeout: LOADED_MACHINE_TEST_TIMEOUT_MS };
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
                },
              },
            }),
          ],
          test: {
            name: 'workers',
            include: ['test/**/*.test.ts'],
            exclude: [...configDefaults.exclude, ...NODE_TESTS],
            setupFiles: ['test/apply-migrations.ts'],
            ...timeouts,
          },
        },
        { test: { name: 'node', environment: 'node', include: NODE_TESTS, ...timeouts } },
      ],
    },
  };
});
