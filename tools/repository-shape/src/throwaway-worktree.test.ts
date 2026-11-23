import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { IS_INSIDE_PROOF, checkOutHead, createThrowawayWorktree, failuresOf, isOutside, run } from './throwaway-worktree';

const LIBRARY_PREFIX = 'libs/example/';
const APPLICATION_PREFIX = 'apps/example/';
const DOCUMENTS_PREFIX = 'docs/';
const LOCKFILE = 'pnpm-lock.yaml';
const SUCCESS_STATUS = 0;
const SCRATCH_IDENTITY = ['-c', 'user.name=proof', '-c', 'user.email=proof@example.com'];

let scratchRepository = '';

function git(gitArguments: string[]): void {
  run({ command: ['git', ...SCRATCH_IDENTITY, ...gitArguments], directory: scratchRepository });
}

describe('isOutside', () => {
  test('accepts the lockfile when a workspace package is involved', () => {
    expect(isOutside({ path: LOCKFILE, prefixes: [DOCUMENTS_PREFIX, APPLICATION_PREFIX] })).toBe(false);
    expect(isOutside({ path: LOCKFILE, prefixes: [LIBRARY_PREFIX] })).toBe(false);
  });

  test('refuses the lockfile when no workspace package is involved', () => {
    expect(isOutside({ path: LOCKFILE, prefixes: [DOCUMENTS_PREFIX] })).toBe(true);
  });

  test('accepts the folders themselves', () => {
    expect(isOutside({ path: `${LIBRARY_PREFIX}index.ts`, prefixes: [LIBRARY_PREFIX] })).toBe(false);
  });

  test('refuses any other path', () => {
    expect(isOutside({ path: 'libs/other/src/index.ts', prefixes: [LIBRARY_PREFIX, APPLICATION_PREFIX] })).toBe(true);
  });
});

describe('failuresOf', () => {
  test('reports a failing command with its output and skips a passing one', () => {
    const failures = failuresOf({
      suites: [
        ['node', '-e', 'process.exit(0)'],
        ['node', '-e', 'console.log("broken"); process.exit(1)'],
      ],
      directory: tmpdir(),
    });
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('broken');
  });
});

describe.skipIf(IS_INSIDE_PROOF)('the throwaway worktree', () => {
  beforeAll(() => {
    scratchRepository = mkdtempSync(join(tmpdir(), 'todz-proof-repository-'));
    git(['init', '-q', '-b', 'main']);
    git(['commit', '-q', '--allow-empty', '-m', 'initial']);
  });

  afterAll(() => {
    rmSync(scratchRepository, { recursive: true, force: true });
  });

  test('removing it also deletes the temporary parent folder', () => {
    const worktree = createThrowawayWorktree({ repository: scratchRepository });
    const parent = dirname(worktree.directory);
    expect(existsSync(parent)).toBe(true);
    worktree.remove();
    expect(existsSync(parent)).toBe(false);
  });

  test('a checkout first prunes the worktrees whose folder is gone', () => {
    const stale = createThrowawayWorktree({ repository: scratchRepository });
    const fresh = createThrowawayWorktree({ repository: scratchRepository });
    expect(checkOutHead({ repository: scratchRepository, directory: stale.directory }).status).toBe(SUCCESS_STATUS);
    rmSync(stale.directory, { recursive: true, force: true });
    expect(checkOutHead({ repository: scratchRepository, directory: fresh.directory }).status).toBe(SUCCESS_STATUS);
    const listing = run({ command: ['git', 'worktree', 'list', '--porcelain'], directory: scratchRepository }).output;
    expect(listing).not.toContain(stale.directory);
    fresh.remove();
    stale.remove();
  });
});
