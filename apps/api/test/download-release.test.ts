import { describe, expect, test } from 'vitest';
import { isDownloadReleased } from '../src/site/download-release';

const LATEST_URL = 'https://todz.app/download/latest';
const RELEASED_LOCATION = '/download/0.2.0/Todz-0.2.0.dmg';
const FOUND_STATUS = 302;
const OK_STATUS = 200;
const NOT_FOUND_STATUS = 404;
const SERVER_ERROR_STATUS = 500;

type AssetRequest = { url: string; redirect: string };

function assetsAnswering(answer: Response): { assets: Fetcher; requests: AssetRequest[] } {
  const requests: AssetRequest[] = [];
  const assets = {
    fetch: async (request: Request) => {
      requests.push({ url: request.url, redirect: request.redirect });
      return answer;
    },
  } as unknown as Fetcher;
  return { assets, requests };
}

function redirectTo(location: string): Response {
  return new Response(null, { status: FOUND_STATUS, headers: { Location: location } });
}

describe('isDownloadReleased', () => {
  test('is true when /download/latest redirects to a versioned disk image, asked without following the redirect', async () => {
    const { assets, requests } = assetsAnswering(redirectTo(RELEASED_LOCATION));
    expect(await isDownloadReleased({ ASSETS: assets })).toBe(true);
    expect(requests).toEqual([{ url: LATEST_URL, redirect: 'manual' }]);
  });

  test('is false when nothing is staged and the assets answer 404', async () => {
    const { assets } = assetsAnswering(new Response(null, { status: NOT_FOUND_STATUS }));
    expect(await isDownloadReleased({ ASSETS: assets })).toBe(false);
  });

  test.each([
    { name: 'a 200', answer: new Response('x', { status: OK_STATUS }) },
    { name: 'a 500', answer: new Response(null, { status: SERVER_ERROR_STATUS }) },
    { name: 'a redirect to somewhere else', answer: redirectTo('https://example.com/Todz-0.2.0.dmg') },
    { name: 'a redirect without a location', answer: new Response(null, { status: FOUND_STATUS }) },
  ])('throws on $name instead of guessing', async ({ answer }) => {
    const { assets } = assetsAnswering(answer);
    await expect(isDownloadReleased({ ASSETS: assets })).rejects.toThrow();
  });
});
