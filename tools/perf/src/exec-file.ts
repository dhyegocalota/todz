import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export type ExecFile = (file: string, args: string[], options: { timeout: number; maxBuffer?: number }) => Promise<{ stdout: string }>;

export const realExecFile: ExecFile = promisify(execFile);
