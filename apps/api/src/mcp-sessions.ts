import { MILLISECONDS_PER_DAY } from '@todz/types';
import { digestCredential } from './credential-digest';
import { generateCredentialSecret } from './credential-secret';
import { findMcpSessionClient, insertMcpSession } from './directory';

const MCP_SESSION_LIFETIME_DAYS = 30;
const MCP_SESSION_LIFETIME_MS = MCP_SESSION_LIFETIME_DAYS * MILLISECONDS_PER_DAY;

// NB ADR 0017: a 2025-era client is named by a session bound to the key it came with.
export async function openMcpSession({
  directory,
  keyDigest,
  clientName,
  now,
}: {
  directory: D1Database;
  keyDigest: string;
  clientName: string;
  now: number;
}): Promise<string> {
  const sessionId = generateCredentialSecret();
  await insertMcpSession({
    directory,
    digest: await digestCredential(sessionId),
    keyDigest,
    clientName,
    now,
    expiresAt: now + MCP_SESSION_LIFETIME_MS,
  });
  return sessionId;
}

export async function findSessionClientName({
  directory,
  sessionId,
  keyDigest,
  now,
}: {
  directory: D1Database;
  sessionId: string;
  keyDigest: string;
  now: number;
}): Promise<string | null> {
  return findMcpSessionClient({ directory, digest: await digestCredential(sessionId), keyDigest, now });
}
