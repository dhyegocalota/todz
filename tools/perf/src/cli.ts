import type { ChangeSignals } from './change-feed';
import type { ExecFile } from './exec-file';
import type { LoopClock } from './open-loop';
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

export function runCli(_: { argv: string[]; dependencies: CliDependencies }): Promise<number> {
  throw new Error('runCli is not implemented');
}
