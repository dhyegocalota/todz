import type { ExecFile } from './exec-file';
import type { AppCheck } from './probe-log';

export function appChecks(_: {
  execFile: ExecFile;
  readSends: (path: string) => Promise<string>;
  sendsPath: string | null;
}): Promise<AppCheck[]> {
  throw new Error('appChecks is not implemented');
}
