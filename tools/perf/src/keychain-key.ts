export type ExecFile = (file: string, args: string[], options: { timeout: number }) => Promise<{ stdout: string }>;

export function readKeychainKey(_: { execFile: ExecFile }): Promise<string> {
  throw new Error('readKeychainKey is not implemented');
}
