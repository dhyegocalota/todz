export async function findKeyProject({ directory, digest }: { directory: D1Database; digest: string }): Promise<string | null> {
  throw new Error('findKeyProject is not implemented');
}

export async function findSessionOwner({
  directory,
  digest,
  now,
}: {
  directory: D1Database;
  digest: string;
  now: number;
}): Promise<string | null> {
  throw new Error('findSessionOwner is not implemented');
}

export async function findOwnedProject({
  directory,
  ownerId,
  projectId,
}: {
  directory: D1Database;
  ownerId: string;
  projectId: string;
}): Promise<string | null> {
  throw new Error('findOwnedProject is not implemented');
}
