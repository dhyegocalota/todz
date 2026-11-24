import { PROJECT_KEY_PREFIX } from '@todz/types';
import { digestCredential } from './credential-digest';
import { generateCredentialSecret } from './credential-secret';
import { insertProjectKey } from './directory';

// NB ADR 0019: a key is shown once and only its digest is stored.
export async function issueProjectKey({
  directory,
  projectId,
  now,
}: {
  directory: D1Database;
  projectId: string;
  now: number;
}): Promise<string> {
  const secret = `${PROJECT_KEY_PREFIX}${generateCredentialSecret()}`;
  await insertProjectKey({ directory, digest: await digestCredential(secret), projectId, now });
  return secret;
}
