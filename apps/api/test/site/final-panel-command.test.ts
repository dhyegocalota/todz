import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { LANDING_COPY } from '../../src/site/landing-copy';

const PACKAGE_MANIFEST = join(import.meta.dirname, '..', '..', 'package.json');
const DEPLOY_SCRIPT = 'server:deploy';

test('the self-host terminal shows a script the API package declares', () => {
  const manifest = JSON.parse(readFileSync(PACKAGE_MANIFEST, 'utf8')) as { scripts: Record<string, string> };
  expect(manifest.scripts[DEPLOY_SCRIPT]).toBeDefined();
  expect(LANDING_COPY.ways.selfHost.terminal.command).toBe(`pnpm --filter @todz/api ${DEPLOY_SCRIPT}`);
});
