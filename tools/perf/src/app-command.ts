import type { ExecFile } from './exec-file';
import { fieldOf, numberOf } from './json-reader';
import {
  type AppCheck,
  type ProbeEvent,
  ProbeEventKind,
  type Send,
  arrivalCheck,
  arrivalLatencies,
  footprintCheck,
  launchCheck,
  probeEventsOf,
  scrollCheck,
} from './probe-log';

const LOG_WINDOW = '1h';
const LOG_TIMEOUT_MS = 60_000;
const LOG_BUFFER_BYTES = 256 * 1024 * 1024;
const LOG_ARGUMENTS = ['show', '--info', '--last', LOG_WINDOW, '--style', 'compact', '--predicate', 'category == "perf"'];
const JSON_LINE_START = '{';

const CHECK_OF_KIND: { kind: ProbeEventKind; check: (events: ProbeEvent[]) => AppCheck }[] = [
  { kind: ProbeEventKind.LaunchReady, check: launchCheck },
  { kind: ProbeEventKind.Scroll, check: scrollCheck },
  { kind: ProbeEventKind.Footprint, check: footprintCheck },
];

function sendsOf(sendsText: string): Send[] {
  return sendsText
    .split('\n')
    .filter((line) => line.startsWith(JSON_LINE_START))
    .map((line): Send => {
      const value: unknown = JSON.parse(line);
      return { number: numberOf(fieldOf({ value, name: 'number' })), sentAtMs: numberOf(fieldOf({ value, name: 'sentAtMs' })) };
    });
}

export async function appChecks({
  execFile,
  readSends,
  sendsPath,
}: {
  execFile: ExecFile;
  readSends: (path: string) => Promise<string>;
  sendsPath: string | null;
}): Promise<AppCheck[]> {
  const { stdout } = await execFile('log', LOG_ARGUMENTS, { timeout: LOG_TIMEOUT_MS, maxBuffer: LOG_BUFFER_BYTES });
  const events = probeEventsOf(stdout);
  if (events.length === 0) throw new Error('the log holds no perf line');
  const checks = CHECK_OF_KIND.filter(({ kind }) => events.some((event) => event.kind === kind)).map(({ check }) => check(events));
  if (sendsPath === null) return checks;
  const sends = sendsOf(await readSends(sendsPath));
  return [...checks, arrivalCheck(arrivalLatencies({ sends, events }))];
}
