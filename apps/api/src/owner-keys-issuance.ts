import { OWNER_KEY_PREFIX, OWNER_LIVE_KEYS_MAX } from '@todz/types';
import { digestCredential } from './credential-digest';
import { generateCredentialSecret } from './credential-secret';
import { insertOwnerKey } from './directory-owner-keys';
import { type IssuedKey, keyHintOf } from './project-keys';

// NB ADR 0101: an owner key is shown once, only its digest is stored, and its prefix tells it apart from a project key.
export async function issueOwnerKey({
  directory,
  ownerId,
  now,
}: {
  directory: D1Database;
  ownerId: string;
  now: number;
}): Promise<IssuedKey | null> {
  const secret = `${OWNER_KEY_PREFIX}${generateCredentialSecret()}`;
  const id = crypto.randomUUID();
  const isInserted = await insertOwnerKey({
    directory,
    digest: await digestCredential(secret),
    id,
    hint: keyHintOf(secret),
    ownerId,
    now,
    liveKeysPerOwnerMax: OWNER_LIVE_KEYS_MAX,
  });
  if (!isInserted) return null;
  return { id, secret };
}
