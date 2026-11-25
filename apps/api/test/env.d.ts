import type { D1Migration } from 'cloudflare:test';
import type { Env } from '../src/env';

declare global {
  namespace Cloudflare {
    interface Env extends ApiEnv {
      MIGRATIONS: D1Migration[];
      MIGRATION_DIRECTORY: D1Database;
      SETTING_DEFAULT_STATEMENTS: Record<string, string>;
    }
    interface GlobalProps {
      mainModule: typeof import('../src/index');
    }
  }
}

type ApiEnv = Env;
