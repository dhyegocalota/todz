import { pathToFileURL } from 'node:url';
import { parseArguments } from './arguments';
import type { ChangeSignals } from './change-feed';
import { CliCommand, ExitCode, commandsOf } from './commands';
import type { ExecFile } from './exec-file';
import type { LoopClock } from './open-loop';
import { realDependencies } from './real-dependencies';
import { UsageError } from './usage-error';
import type { Scheduler } from './wire-guard';

export type CliDependencies = {
  fetch: typeof fetch;
  now: () => number;
  epochNow: () => number;
  clock: LoopClock;
  schedule: Scheduler;
  execFile: ExecFile;
  readFile: (path: string) => Promise<string>;
  openSignals: (access: { origin: string; token: string; projectId: string }) => Promise<ChangeSignals>;
  randomIdentifier: () => string;
  out: (text: string) => void;
  err: (text: string) => void;
};

const USAGE = [
  'usage: pnpm perf <command>',
  '  load [--target local]',
  '  stress [--target local]',
  '  seed --tasks <n> --projects <n>',
  '  soak --minutes <n>',
  '  production [--cleanup <run>]',
  '  app [--sends <file>]',
  '  tail <file>',
].join('\n');

function commandOf(name: string | null): CliCommand | null {
  const command = Object.values(CliCommand).find((candidate) => candidate === name);
  if (command === undefined) return null;
  return command;
}

export async function runCli({ argv, dependencies }: { argv: string[]; dependencies: CliDependencies }): Promise<number> {
  const parsed = parseArguments(argv);
  const command = commandOf(parsed.command);
  if (command === null) {
    dependencies.err(`${USAGE}\n`);
    return ExitCode.Usage;
  }
  try {
    return await commandsOf(dependencies)[command](parsed);
  } catch (failure) {
    const message = failure instanceof Error ? failure.message : String(failure);
    dependencies.err(`${message}\n`);
    if (failure instanceof UsageError) return ExitCode.Usage;
    return ExitCode.Failed;
  }
}

const isEntryPoint = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) process.exitCode = await runCli({ argv: process.argv.slice(2), dependencies: realDependencies() });
