export async function issueProjectKey({
  directory,
  projectId,
  now,
}: {
  directory: D1Database;
  projectId: string;
  now: number;
}): Promise<string> {
  throw new Error('issueProjectKey is not implemented');
}
