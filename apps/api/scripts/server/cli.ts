import { MINIMUM_APP_VERSION } from '@todz/types';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { deployArguments } from './deploy-arguments';
import { publicOriginInWranglerText, readyLine } from './ready-line';
import { STAMP_FAILURE_MESSAGE, versionStamp } from './version-stamp';

const WRANGLER_CONFIGURATION_PATH = fileURLToPath(new URL('../../wrangler.jsonc', import.meta.url));
const GIT_COMMAND = 'git';
const WRANGLER_COMMAND = 'wrangler';
const COMMIT_DATE_ARGUMENTS = ['log', '-1', '--format=%cd', '--date=format-local:%Y-%m-%d'];
const COMMIT_HASH_ARGUMENTS = ['rev-parse', 'HEAD'];
const UTC_TIME_ZONE = 'UTC';
const SUCCESS_STATUS = 0;
const KILLED_STATUS = 1;

function gitOutput(gitArguments: string[]): string {
  try {
    return execFileSync(GIT_COMMAND, gitArguments, { encoding: 'utf8', env: { ...process.env, TZ: UTC_TIME_ZONE } }).trim();
  } catch (error) {
    throw new Error(`${STAMP_FAILURE_MESSAGE}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const serverVersion = versionStamp({ commitDate: gitOutput(COMMIT_DATE_ARGUMENTS), commitHash: gitOutput(COMMIT_HASH_ARGUMENTS) });
const { status } = spawnSync(WRANGLER_COMMAND, deployArguments(serverVersion), { stdio: 'inherit' });
if (status !== SUCCESS_STATUS) process.exit(status === null ? KILLED_STATUS : status);

console.log(
  readyLine({
    publicOrigin: publicOriginInWranglerText(readFileSync(WRANGLER_CONFIGURATION_PATH, 'utf8')),
    serverVersion,
    minimumAppVersion: MINIMUM_APP_VERSION,
  }),
);
