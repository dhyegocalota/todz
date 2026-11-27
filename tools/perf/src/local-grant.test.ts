import { createHash } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import { WRANGLER_TIMEOUT_MS } from './budgets';
import type { ExecFile } from './exec-file';
import { mintLocalAccessToken } from './local-grant';

const OWNER_ID = 'owner-1';
const PROJECT_ID = 'inbox-1';
const EPOCH_NOW = 1_700_000_000_000;
const ONE_DAY_MS = 86_400_000;

type Call = { file: string; args: string[]; timeout: number };

function recordingExecFile(): { execFile: ExecFile; calls: Call[] } {
  const calls: Call[] = [];
  const execFile: ExecFile = async (file, args, options) => {
    calls.push({ file, args, timeout: options.timeout });
    return { stdout: '' };
  };
  return { execFile, calls };
}

describe('mintLocalAccessToken', () => {
  test('returns an access token and writes only its digest, with a client, a grant for the project and the token, through one local D1 command', async () => {
    const { execFile, calls } = recordingExecFile();

    const token = await mintLocalAccessToken({ execFile, ownerId: OWNER_ID, projectId: PROJECT_ID, epochNow: EPOCH_NOW });

    expect(token).toMatch(/^todz-at_[A-Za-z0-9_-]{43}$/);
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call).toMatchObject({ file: 'pnpm', timeout: WRANGLER_TIMEOUT_MS });
    expect(call!.args.slice(0, -1)).toEqual([
      '--filter',
      '@todz/api',
      'exec',
      'wrangler',
      'd1',
      'execute',
      'todz-directory',
      '--local',
      '--command',
    ]);
    const sql = call!.args.at(-1)!;
    expect(sql).toContain(createHash('sha256').update(token).digest('hex'));
    expect(sql).not.toContain(token);
    expect(sql).toContain(`'${OWNER_ID}', '${PROJECT_ID}'`);
    expect(sql).toContain(`${EPOCH_NOW + ONE_DAY_MS})`);
    expect(sql.split('; ').map((statement) => statement.split(' (')[0])).toEqual([
      'INSERT INTO oauth_clients',
      'INSERT INTO oauth_grants',
      'INSERT INTO oauth_tokens',
    ]);
  });

  test('every call mints another token', async () => {
    const { execFile } = recordingExecFile();

    const first = await mintLocalAccessToken({ execFile, ownerId: OWNER_ID, projectId: PROJECT_ID, epochNow: EPOCH_NOW });
    const second = await mintLocalAccessToken({ execFile, ownerId: OWNER_ID, projectId: PROJECT_ID, epochNow: EPOCH_NOW });

    expect(first).not.toBe(second);
  });

  test('a failing command fails the mint and returns no token', async () => {
    const execFile: ExecFile = async () => {
      throw new Error('wrangler failed');
    };

    await expect(mintLocalAccessToken({ execFile, ownerId: OWNER_ID, projectId: PROJECT_ID, epochNow: EPOCH_NOW })).rejects.toThrow(
      'wrangler failed',
    );
  });
});
