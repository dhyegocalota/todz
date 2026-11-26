import { MILLISECONDS_PER_SECOND } from '@todz/types';
import {
  REPOSITORY_API_ACCEPT,
  REPOSITORY_STARS_CACHE_MS,
  REPOSITORY_STARS_RETRY_MS,
  REPOSITORY_STARS_TIMEOUT_MS,
  REPOSITORY_USER_AGENT,
  STARS_FORMAT_LOCALE,
  STARS_FORMAT_OPTIONS,
} from './site-constants';

export type RepositoryStarsCache = Pick<Cache, 'match' | 'put'>;

type CachedStars = { stars: number | null };
type RepositoryBody = { stargazers_count?: unknown };

const STARS_FORMAT = new Intl.NumberFormat(STARS_FORMAT_LOCALE, STARS_FORMAT_OPTIONS);

export function formatStars(count: number): string {
  return STARS_FORMAT.format(count).toLowerCase();
}

async function remember({
  cache,
  apiUrl,
  stars,
  lifetimeMs,
}: {
  cache: RepositoryStarsCache;
  apiUrl: string;
  stars: number | null;
  lifetimeMs: number;
}): Promise<number | null> {
  const cached: CachedStars = { stars };
  const headers = { 'Cache-Control': `max-age=${lifetimeMs / MILLISECONDS_PER_SECOND}` };
  await cache.put(apiUrl, Response.json(cached, { headers }));
  return stars;
}

function noStars({ cache, apiUrl }: { cache: RepositoryStarsCache; apiUrl: string }): Promise<number | null> {
  return remember({ cache, apiUrl, stars: null, lifetimeMs: REPOSITORY_STARS_RETRY_MS });
}

export async function repositoryStarsOf({
  fetchImplementation,
  cache,
  apiUrl,
}: {
  fetchImplementation: typeof fetch;
  cache: RepositoryStarsCache;
  apiUrl: string;
}): Promise<number | null> {
  const cached = await cache.match(apiUrl);
  if (cached !== undefined) return ((await cached.json()) as CachedStars).stars;
  const response = await fetchImplementation(apiUrl, {
    headers: { Accept: REPOSITORY_API_ACCEPT, 'User-Agent': REPOSITORY_USER_AGENT },
    signal: AbortSignal.timeout(REPOSITORY_STARS_TIMEOUT_MS),
  }).catch(() => null);
  if (response === null || !response.ok) return noStars({ cache, apiUrl });
  const body = (await response.json().catch(() => null)) as RepositoryBody | null;
  const stars = body?.stargazers_count;
  const isStarCount = typeof stars === 'number' && Number.isInteger(stars) && stars >= 0;
  if (!isStarCount) return noStars({ cache, apiUrl });
  return remember({ cache, apiUrl, stars, lifetimeMs: REPOSITORY_STARS_CACHE_MS });
}
