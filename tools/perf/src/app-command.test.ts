import { describe, expect, test } from 'vitest';
import { appChecks } from './app-command';
import type { ExecFile } from './exec-file';
import { PERF_PREDICATE } from './probe-log';
import { Verdict } from './report';

const PREFIX = '2026-11-25 10:00:00.123 Df Todz[1234:abcd] [dev.todz.Todz.debug:perf]';
const LAUNCHES = [620, 700, 710, 690, 640].map((ms) => `${PREFIX} launch-ready ms=${ms}`);
const SCROLL = `${PREFIX} scroll frames=600 over-budget=3 worst-ms=40 refresh-ms=17`;

function logOf(lines: string[]): { execFile: ExecFile; calls: { file: string; args: string[] }[] } {
  const calls: { file: string; args: string[] }[] = [];
  const execFile: ExecFile = async (file, args) => {
    calls.push({ file, args });
    return { stdout: lines.join('\n') };
  };
  return { execFile, calls };
}

const unreadable = async () => {
  throw new Error('no sends file expected');
};

describe('appChecks', () => {
  test('it reads the unified log for the perf category and checks what the probe logged', async () => {
    const { execFile, calls } = logOf([...LAUNCHES, SCROLL]);
    const checks = await appChecks({ execFile, readSends: unreadable, sendsPath: null });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.file).toBe('log');
    expect(calls[0]?.args).toContain(PERF_PREDICATE);
    expect(PERF_PREDICATE).toContain('subsystem == "dev.todz.Todz"');
    expect(checks.map((check) => [check.name, check.verdict])).toEqual([
      ['launch', Verdict.Pass],
      ['scroll', Verdict.Pass],
    ]);
  });

  test('footprint lines too few for a soak do not hide the launch verdict', async () => {
    const footprints = [180, 59, 59].map((mb) => `${PREFIX} footprint mb=${mb}`);
    const { execFile } = logOf([...LAUNCHES, ...footprints]);
    const checks = await appChecks({ execFile, readSends: unreadable, sendsPath: null });
    expect(checks.map((check) => [check.name, check.verdict])).toEqual([
      ['launch', Verdict.Pass],
      ['footprint', Verdict.Skip],
    ]);
  });

  test('given the sends of a production run, it joins them to the arrival lines', async () => {
    const { execFile } = logOf([`${PREFIX} task-arrived number=7 at-ms=1640`]);
    const readSends = async () => 'a pnpm header line\n{"number":7,"sentAtMs":1000}\n';
    const checks = await appChecks({ execFile, readSends, sendsPath: '/scratch/sends.jsonl' });
    expect(checks).toEqual([{ name: 'change feed', summary: 'p95 640 ms over 1 tasks', verdict: Verdict.Pass }]);
  });

  test('a log with no perf line throws', async () => {
    const { execFile } = logOf(['Timestamp  Ty Process[PID:TID]']);
    await expect(appChecks({ execFile, readSends: unreadable, sendsPath: null })).rejects.toThrow('the log holds no perf line');
  });
});
