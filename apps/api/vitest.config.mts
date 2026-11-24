import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

const LOADED_MACHINE_TEST_TIMEOUT_MS = 30_000;

export default defineConfig(async () => {
  const migrations = await readD1Migrations('migrations');
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: { bindings: { MIGRATIONS: migrations, SIGN_IN_PROVIDER: 'fake' } },
      }),
    ],
    test: {
      include: ['test/**/*.test.ts'],
      setupFiles: ['test/apply-migrations.ts'],
      testTimeout: LOADED_MACHINE_TEST_TIMEOUT_MS,
      hookTimeout: LOADED_MACHINE_TEST_TIMEOUT_MS,
    },
  };
});
