import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { MILLISECONDS_PER_DAY, OAUTH_ACCESS_TOKEN_PREFIX } from '@todz/types';
import { WRANGLER_TIMEOUT_MS } from './budgets';
import type { ExecFile } from './exec-file';

const DIRECTORY_DATABASE = 'todz-directory';
const CLIENT_NAME = 'todz-perf';
const REDIRECT_URI = 'http://127.0.0.1/callback';
const ACCESS_KIND = 'access';
const DIGEST_ENCODING = 'base64url';
const TOKEN_BYTE_LENGTH = 32;
const CLIENT_IDENTIFIER_BYTE_LENGTH = 32;
const WRANGLER_ARGUMENTS = ['--filter', '@todz/api', 'exec', 'wrangler', 'd1', 'execute', DIRECTORY_DATABASE, '--local', '--command'];

function grantStatements({ ownerId, projectId, digest, now }: { ownerId: string; projectId: string; digest: string; now: number }): string {
  const clientId = randomBytes(CLIENT_IDENTIFIER_BYTE_LENGTH).toString(DIGEST_ENCODING);
  const grantId = randomUUID();
  return [
    `INSERT INTO oauth_clients (id, name, redirect_uris, created_at, active_at) VALUES ('${clientId}', '${CLIENT_NAME}', '["${REDIRECT_URI}"]', ${now}, ${now})`,
    `INSERT INTO oauth_grants (id, client_id, owner_id, project_id, redirect_uri, created_at, last_used_at) VALUES ('${grantId}', '${clientId}', '${ownerId}', '${projectId}', '${REDIRECT_URI}', ${now}, ${now})`,
    `INSERT INTO oauth_tokens (digest, grant_id, kind, created_at, expires_at) VALUES ('${digest}', '${grantId}', '${ACCESS_KIND}', ${now}, ${now + MILLISECONDS_PER_DAY})`,
  ].join('; ');
}

export async function mintLocalAccessToken({
  execFile,
  ownerId,
  projectId,
  epochNow,
}: {
  execFile: ExecFile;
  ownerId: string;
  projectId: string;
  epochNow: number;
}): Promise<string> {
  const token = `${OAUTH_ACCESS_TOKEN_PREFIX}${randomBytes(TOKEN_BYTE_LENGTH).toString(DIGEST_ENCODING)}`;
  const digest = createHash('sha256').update(token).digest('hex');
  await execFile('pnpm', [...WRANGLER_ARGUMENTS, grantStatements({ ownerId, projectId, digest, now: epochNow })], {
    timeout: WRANGLER_TIMEOUT_MS,
  });
  return token;
}
