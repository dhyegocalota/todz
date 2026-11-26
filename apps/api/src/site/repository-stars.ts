export type RepositoryStarsCache = Pick<Cache, 'match' | 'put'>;

export function formatStars(_count: number): string {
  throw new Error('formatStars is not implemented');
}

export async function repositoryStarsOf(_input: {
  fetchImplementation: typeof fetch;
  cache: RepositoryStarsCache;
  apiUrl: string;
}): Promise<number | null> {
  throw new Error('repositoryStarsOf is not implemented');
}
