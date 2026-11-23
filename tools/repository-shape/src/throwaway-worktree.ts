import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export const PROOF_ENVIRONMENT_VARIABLE = 'TODZ_WORKTREE_PROOF';
export const IS_INSIDE_PROOF = process.env[PROOF_ENVIRONMENT_VARIABLE] !== undefined;
const MAXIMUM_BUFFER = 64 * 1024 * 1024;
const STATUS_PATH_OFFSET = 3;
const LOCKFILE = 'pnpm-lock.yaml';
const WORKSPACE_PREFIXES = ['apps/', 'libs/', 'tools/'];
const COLD_METADATA_CACHE_FOLDER = 'pnpm-metadata-cache';
const OUTPUT_TAIL_LENGTH = 3000;

export type CommandOutcome = { status: number | null; output: string };

export enum LockfileMode {
  Frozen = '--frozen-lockfile',
  Resolve = '--no-frozen-lockfile',
}

const LOCKFILE_INSTALL_FLAGS: Record<LockfileMode, string[]> = {
  [LockfileMode.Frozen]: [LockfileMode.Frozen, '--offline'],
  [LockfileMode.Resolve]: [LockfileMode.Resolve, '--prefer-offline'],
};

export const FULL_SUITES: string[][] = [
  ['pnpm', 'typecheck'],
  ['bash', '.agents/hooks/doctor.sh'],
  ['bash', '.agents/hooks/hooks.test.sh'],
  ['pnpm', '--filter', '@todz/repository-shape', 'test:unit'],
  ['pnpm', '--filter', '@todz/types', 'test:unit'],
];

export function run(input: { command: string[]; directory: string; environment?: Record<string, string> }): CommandOutcome {
  const [program, ...commandArguments] = input.command;
  const result = spawnSync(program as string, commandArguments, {
    cwd: input.directory,
    encoding: 'utf8',
    maxBuffer: MAXIMUM_BUFFER,
    env: { ...process.env, [PROOF_ENVIRONMENT_VARIABLE]: '1', ...input.environment },
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

export function installDependencies(input: { directory: string; lockfile: LockfileMode }): CommandOutcome {
  return run({
    command: ['pnpm', 'install', ...LOCKFILE_INSTALL_FLAGS[input.lockfile]],
    directory: input.directory,
    environment: { CI: 'true', npm_config_cache_dir: join(dirname(input.directory), COLD_METADATA_CACHE_FOLDER) },
  });
}

export function changedPathsOf(input: { directory: string }): string[] {
  const status = run({ command: ['git', 'status', '--porcelain', '--untracked-files=all'], directory: input.directory });
  return status.output
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(STATUS_PATH_OFFSET));
}

export function isOutside(input: { path: string; prefixes: string[] }): boolean {
  const isInsidePrefix = input.prefixes.some((prefix) => input.path.startsWith(prefix));
  const followsWorkspacePackage =
    input.path === LOCKFILE && input.prefixes.some((prefix) => WORKSPACE_PREFIXES.some((workspace) => prefix.startsWith(workspace)));
  return !isInsidePrefix && !followsWorkspacePackage;
}

export function createThrowawayWorktree(input: { repository: string }): { directory: string; remove: () => void } {
  const parent = mkdtempSync(join(tmpdir(), 'todz-worktree-'));
  const directory = join(parent, 'tree');
  return {
    directory,
    remove: () => {
      if (IS_INSIDE_PROOF) return;
      run({ command: ['git', 'worktree', 'remove', '--force', directory], directory: input.repository });
      rmSync(parent, { recursive: true, force: true });
    },
  };
}

export function checkOutHead(input: { repository: string; directory: string }): CommandOutcome {
  run({ command: ['git', 'worktree', 'prune'], directory: input.repository });
  return run({ command: ['git', 'worktree', 'add', '--detach', input.directory, 'HEAD'], directory: input.repository });
}

export function failuresOf(input: { suites: string[][]; directory: string }): string[] {
  return input.suites
    .map((command) => ({ command: command.join(' '), ...run({ command, directory: input.directory }) }))
    .filter((suite) => suite.status !== 0)
    .map((suite) => `${suite.command}\n${suite.output.slice(-OUTPUT_TAIL_LENGTH)}`);
}
