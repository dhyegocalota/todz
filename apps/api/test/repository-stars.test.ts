import { MILLISECONDS_PER_HOUR, MILLISECONDS_PER_MINUTE, MILLISECONDS_PER_SECOND, REPOSITORY } from '@todz/types';
import { describe, expect, test, vi } from 'vitest';
import { type RepositoryStarsCache, formatStars, repositoryStarsOf } from '../src/site/repository-stars';

const API_URL = `https://api.github.com/repos/${REPOSITORY.path}`;
const STARS = 1234;
const CACHE_SECONDS = MILLISECONDS_PER_HOUR / MILLISECONDS_PER_SECOND;
const RETRY_SECONDS = (5 * MILLISECONDS_PER_MINUTE) / MILLISECONDS_PER_SECOND;
const MAX_AGE_PATTERN = /max-age=(\d+)/;

type CachedEntry = { stars: number | null; maxAgeSeconds: number };

function memoryCache(): { cache: RepositoryStarsCache; entries: Map<string, CachedEntry> } {
  const entries = new Map<string, CachedEntry>();
  const cache: RepositoryStarsCache = {
    async match(request) {
      const entry = entries.get(String(request));
      if (entry === undefined) return undefined;
      return Response.json({ stars: entry.stars });
    },
    async put(request, response) {
      const { stars } = (await response.json()) as { stars: number | null };
      const maxAge = MAX_AGE_PATTERN.exec(String(response.headers.get('Cache-Control')));
      if (maxAge === null) throw new Error('the cached answer states its lifetime');
      entries.set(String(request), { stars, maxAgeSeconds: Number(maxAge[1]) });
    },
  };
  return { cache, entries };
}

function answering(body: unknown, init?: ResponseInit): typeof fetch {
  return vi.fn(async () => Response.json(body, init)) as unknown as typeof fetch;
}

function callOf(fetchImplementation: typeof fetch): [unknown, RequestInit] {
  const [call] = vi.mocked(fetchImplementation).mock.calls;
  if (call === undefined) throw new Error('the fetch was called');
  const [url, init] = call;
  if (init === undefined) throw new Error('the fetch was called with options');
  return [url, init];
}

describe('the repository stars', () => {
  test('are read from the GitHub API with its accept header and a user agent, and kept for an hour', async () => {
    const { cache, entries } = memoryCache();
    const fetchImplementation = answering({ stargazers_count: STARS });
    expect(await repositoryStarsOf({ fetchImplementation, cache, apiUrl: API_URL })).toBe(STARS);
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
    const [url, init] = callOf(fetchImplementation);
    expect(url).toBe(API_URL);
    expect(init.headers).toMatchObject({ Accept: 'application/vnd.github+json', 'User-Agent': 'todz-site' });
    expect(entries.get(API_URL)).toEqual({ stars: STARS, maxAgeSeconds: CACHE_SECONDS });
  });

  test('come from the cache the second time, without a fetch', async () => {
    const { cache } = memoryCache();
    const fetchImplementation = answering({ stargazers_count: STARS });
    await repositoryStarsOf({ fetchImplementation, cache, apiUrl: API_URL });
    expect(await repositoryStarsOf({ fetchImplementation, cache, apiUrl: API_URL })).toBe(STARS);
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });

  test('bound the fetch by an abort signal', async () => {
    const { cache } = memoryCache();
    const fetchImplementation = answering({ stargazers_count: STARS });
    await repositoryStarsOf({ fetchImplementation, cache, apiUrl: API_URL });
    expect(callOf(fetchImplementation)[1].signal).toBeInstanceOf(AbortSignal);
  });

  test.each([
    ['a network error', vi.fn(async () => Promise.reject(new Error('offline'))) as unknown as typeof fetch],
    ['a non-OK status', answering({ message: 'rate limited' }, { status: 403 })],
    ['a body with no count', answering({ name: 'todz' })],
    ['a count that is not a number', answering({ stargazers_count: '1234' })],
    ['a negative count', answering({ stargazers_count: -1 })],
    ['a fractional count', answering({ stargazers_count: 1.5 })],
    ['a body that is not JSON', vi.fn(async () => new Response('<html>')) as unknown as typeof fetch],
  ])('fail soft to no number on %s, and are not asked again for five minutes', async (_name, fetchImplementation) => {
    const { cache, entries } = memoryCache();
    expect(await repositoryStarsOf({ fetchImplementation, cache, apiUrl: API_URL })).toBeNull();
    expect(entries.get(API_URL)).toEqual({ stars: null, maxAgeSeconds: RETRY_SECONDS });
    expect(await repositoryStarsOf({ fetchImplementation, cache, apiUrl: API_URL })).toBeNull();
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });
});

describe('the star count format', () => {
  test.each([
    [0, '0'],
    [42, '42'],
    [999, '999'],
    [1000, '1k'],
    [1234, '1.2k'],
    [12_345, '12k'],
  ])('writes %i as %s', (count, text) => {
    expect(formatStars(count)).toBe(text);
  });
});
