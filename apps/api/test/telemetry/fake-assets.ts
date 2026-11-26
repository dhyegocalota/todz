export const FEED_BODY = '<rss version="2.0"></rss>';

const FEED_PATH = '/download/appcast.xml';
const CHECKSUM_PATH_PATTERN = /^\/download\/(\d+\.\d+\.\d+)\/Todz-\d+\.\d+\.\d+\.dmg\.sha256$/;
const VERSION_GROUP = 1;
const FOUND_STATUS = 200;
const NOT_FOUND_STATUS = 404;

export function assetsServing({ published }: { published: string[] }): Fetcher {
  const assets = {
    async fetch(input: RequestInfo | URL): Promise<Response> {
      const { pathname } = new URL(input instanceof Request ? input.url : String(input));
      if (pathname === FEED_PATH) return new Response(FEED_BODY, { status: FOUND_STATUS });
      const version = CHECKSUM_PATH_PATTERN.exec(pathname)?.[VERSION_GROUP];
      const isPublished = version !== undefined && published.includes(version);
      return new Response(null, { status: isPublished ? FOUND_STATUS : NOT_FOUND_STATUS });
    },
  };
  return assets as unknown as Fetcher;
}
