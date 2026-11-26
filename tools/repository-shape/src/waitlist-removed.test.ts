import { existsSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { readRepositoryFile, repositoryFiles, repositoryPath } from './repository-files';

const WAITLIST_WORD = 'waitlist';
const SELF_PATH = 'tools/repository-shape/src/waitlist-removed.test.ts';
const WAITLIST_TEST_PATH = 'apps/api/test/waitlist-removed.test.ts';
const CURRENT_STATE_PATHSPECS = [
  'apps/api/src',
  'apps/api/scripts',
  'apps/api/e2e',
  'apps/api/wrangler.jsonc',
  'apps/api/README.md',
  'apps/docs',
  'libs',
  'README.md',
];
const TEST_PATHSPEC = 'apps/api/test';
const TABLE_STATEMENT_PATTERN = /(?:FROM|INTO|UPDATE|JOIN)\s+waitlist\b/i;
const REMOVED_FILES = [
  'apps/api/src/site/waitlist-closed.ts',
  'apps/api/src/site/waitlist-store.ts',
  'apps/api/src/site/admin-waitlist.ts',
  'apps/api/src/site/admin-export.ts',
  'apps/api/src/emails/waitlist-mail.ts',
  'apps/api/src/emails/waitlist-digest-mail.ts',
  'apps/api/src/emails/waitlist-digest-mail-copy.ts',
  'apps/api/scripts/emails/waitlist-template.ts',
  'apps/api/scripts/emails/waitlist-email-copy.ts',
  'apps/api/scripts/emails/waitlist-digest-template.ts',
  'apps/api/scripts/emails/waitlist-digest-email-copy.ts',
  'apps/api/test/waitlist-client.ts',
  'apps/api/test/waitlist-store.test.ts',
  'apps/api/test/waitlist-digest-mail.test.ts',
  'apps/api/test/waitlist-off.test.ts',
  'apps/api/test/admin-export.test.ts',
  'apps/api/test/emails/waitlist-digest-email.test.ts',
  'scripts/deploy-bodies/junk-turnstile-waitlist.txt',
  'scripts/deploy-bodies/missing-token-waitlist.txt',
];
const WRANGLER_CONFIGURATION = 'apps/api/wrangler.jsonc';

function sourceFilesOf(pathspecs: string[]): string[] {
  return pathspecs.flatMap(repositoryFiles).filter((path) => path !== SELF_PATH && path !== WAITLIST_TEST_PATH);
}

describe('the waitlist is removed from the code', () => {
  test.each(REMOVED_FILES)('%s is deleted', (path) => {
    expect(existsSync(repositoryPath(path))).toBe(false);
  });

  test('no current source, script, end-to-end test, configuration, doc or shared constant names it', () => {
    const naming = sourceFilesOf(CURRENT_STATE_PATHSPECS).filter((path) => readRepositoryFile(path).toLowerCase().includes(WAITLIST_WORD));
    expect(naming).toEqual([]);
  });

  test('no test reads or writes the dropped table', () => {
    const reading = sourceFilesOf([TEST_PATHSPEC]).filter((path) => TABLE_STATEMENT_PATTERN.test(readRepositoryFile(path)));
    expect(reading).toEqual([]);
  });

  test('the wrangler configuration holds no waitlist limiter', () => {
    expect(readRepositoryFile(WRANGLER_CONFIGURATION)).not.toMatch(/WAITLIST/);
  });
});
