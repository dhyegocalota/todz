import { PROJECT_KEY_PREFIX, PROJECT_LIVE_KEYS_MAX } from '@todz/types';
import { digestCredential } from './credential-digest';
import { generateCredentialSecret } from './credential-secret';
import { insertProjectKey } from './directory';

const KEY_HINT_LENGTH = 4;

export type IssuedKey = { id: string; secret: string };

export function keyHintOf(secret: string): string {
  return secret.slice(-KEY_HINT_LENGTH);
}

// NB ADR 0019: a key is shown once and only its digest is stored.
export async function issueProjectKey({
  directory,
  projectId,
  now,
}: {
  directory: D1Database;
  projectId: string;
  now: number;
}): Promise<IssuedKey | null> {
  const secret = `${PROJECT_KEY_PREFIX}${generateCredentialSecret()}`;
  const id = crypto.randomUUID();
  const isInserted = await insertProjectKey({
    directory,
    digest: await digestCredential(secret),
    id,
    hint: keyHintOf(secret),
    projectId,
    now,
    liveKeysPerProjectMax: PROJECT_LIVE_KEYS_MAX,
  });
  if (!isInserted) return null;
  return { id, secret };
}
