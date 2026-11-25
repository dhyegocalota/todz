import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { CliDependencies } from './cli';
import { realExecFile } from './exec-file';
import { realClock } from './open-loop';
import { openSocketSignals } from './socket-signals';
import { realScheduler } from './wire-guard';

const IDENTIFIER_LENGTH = 8;
const TEXT_ENCODING = 'utf8';

export function realDependencies(): CliDependencies {
  return {
    fetch,
    now: () => performance.now(),
    epochNow: () => Date.now(),
    clock: realClock,
    schedule: realScheduler,
    execFile: realExecFile,
    readFile: (path) => readFile(path, TEXT_ENCODING),
    openSignals: openSocketSignals,
    randomIdentifier: () => randomUUID().slice(0, IDENTIFIER_LENGTH),
    out: (text) => process.stdout.write(text),
    err: (text) => process.stderr.write(text),
  };
}
