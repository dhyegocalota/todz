import { existsSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { readRepositoryFile, repositoryFiles, repositoryPath } from './repository-files';

const SELF_PATH = 'tools/repository-shape/src/api-keys-removed.test.ts';
const REMOVAL_TEST_PATH = 'apps/api/test/api-keys-removed.test.ts';
const CURRENT_STATE_PATHSPECS = [
  'apps/api/src',
  'apps/api/scripts',
  'apps/api/e2e',
  'apps/api/wrangler.jsonc',
  'apps/api/README.md',
  'apps/docs',
  'libs',
  'tools/perf',
  'README.md',
];
const TEST_PATHSPEC = 'apps/api/test';
const BREAKING_NOTE_PATHS = ['apps/docs/connect-an-agent.mdx', 'apps/docs/releases.mdx', 'apps/api/src/mcp-copy.ts'];
const DROPPED_TABLE_PATTERN = /(?:FROM|INTO|UPDATE|JOIN|TABLE)\s+(?:project_keys|owner_keys|mcp_sessions)\b/i;
const KEY_COPY_PATTERN =
  /project key|owner key|agent key|api key|TODZ_API_KEY|--header 'Authorization|Authorization: Bearer|PROJECT_KEY_PREFIX|OWNER_KEY_PREFIX|LIVE_KEYS/i;
const REMOVED_FILES = [
  'apps/api/src/directory-keys.ts',
  'apps/api/src/directory-owner-keys.ts',
  'apps/api/src/owner-key-routes.ts',
  'apps/api/src/owner-keys-issuance.ts',
  'apps/api/src/owner-keys.ts',
  'apps/api/src/project-keys.ts',
  'apps/api/src/mcp-sessions.ts',
  'apps/api/test/owner-key-routes.test.ts',
  'apps/api/test/owner-keys.test.ts',
  'apps/api/test/project-keys.test.ts',
];

function sourceFilesOf(pathspecs: string[]): string[] {
  return pathspecs.flatMap(repositoryFiles).filter((path) => path !== SELF_PATH && path !== REMOVAL_TEST_PATH);
}

describe('API keys are removed from the code', () => {
  test.each(REMOVED_FILES)('%s is deleted', (path) => {
    expect(existsSync(repositoryPath(path))).toBe(false);
  });

  test('no source, script, end-to-end test, configuration, doc or test reads or writes a dropped table', () => {
    const reading = sourceFilesOf([...CURRENT_STATE_PATHSPECS, TEST_PATHSPEC]).filter((path) =>
      DROPPED_TABLE_PATTERN.test(readRepositoryFile(path)),
    );
    expect(reading).toEqual([]);
  });

  test('only the breaking-change notes and the refusal copy name a key', () => {
    const naming = sourceFilesOf(CURRENT_STATE_PATHSPECS)
      .filter((path) => !BREAKING_NOTE_PATHS.includes(path))
      .filter((path) => KEY_COPY_PATTERN.test(readRepositoryFile(path)));
    expect(naming).toEqual([]);
  });
});
