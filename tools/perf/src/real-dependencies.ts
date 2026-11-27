import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { CliDependencies } from './cli';
import { realExecFile } from './exec-file';
import { openLoopbackReceiver } from './loopback-receiver';
import { authorizedAccessToken } from './oauth-authorize';
import { realClock } from './open-loop';
import { ORIGIN_OF_TARGET, PerfTarget } from './run-plan';
import { openSocketSignals } from './socket-signals';
import { realScheduler } from './wire-guard';

const IDENTIFIER_LENGTH = 8;
const TEXT_ENCODING = 'utf8';
const BROWSER_COMMAND = 'open';
const BROWSER_TIMEOUT_MS = 10_000;

export function realDependencies(): CliDependencies {
  return {
    fetch,
    now: () => performance.now(),
    epochNow: () => Date.now(),
    clock: realClock,
    schedule: realScheduler,
    execFile: realExecFile,
    accessToken: () =>
      authorizedAccessToken({
        origin: ORIGIN_OF_TARGET[PerfTarget.Production],
        dependencies: {
          fetch,
          openUrl: async (url) => {
            await realExecFile(BROWSER_COMMAND, [url], { timeout: BROWSER_TIMEOUT_MS });
          },
          receiver: openLoopbackReceiver,
        },
      }),
    readFile: (path) => readFile(path, TEXT_ENCODING),
    openSignals: openSocketSignals,
    onInterrupt: (handler) => {
      process.once('SIGINT', () => {
        void handler().then((exitCode) => process.exit(exitCode));
      });
    },
    randomIdentifier: () => randomUUID().slice(0, IDENTIFIER_LENGTH),
    out: (text) => process.stdout.write(text),
    err: (text) => process.stderr.write(text),
  };
}
