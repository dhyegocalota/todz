import { describe, expect, test } from 'vitest';
import { IconPurpose, OPEN_GRAPH_IMAGE, SITE_ICONS, SiteIcon } from '../src/site/site-icons';
import { DOCS_URL, DiscoveryPath, MCP_URL, SERVER_CARD_PATH, SITE_URL } from '../src/site/site-urls';

describe('the site urls', () => {
  test('the origins and the card path are the production ones', () => {
    expect({ SITE_URL, MCP_URL, DOCS_URL, SERVER_CARD_PATH }).toEqual({
      SITE_URL: 'https://todz.app',
      MCP_URL: 'https://api.todz.app/mcp',
      DOCS_URL: 'https://docs.todz.app',
      SERVER_CARD_PATH: '/mcp/server-card',
    });
  });

  test('the discovery paths are the seven files agents and crawlers look for', () => {
    expect(Object.values(DiscoveryPath)).toEqual([
      '/robots.txt',
      '/sitemap.xml',
      '/llms.txt',
      '/llms-full.txt',
      '/site.webmanifest',
      '/.well-known/ard.json',
      '/.well-known/mcp/server-card.json',
    ]);
  });
});

describe('the site icons', () => {
  test('each icon has its path, size, media type and purpose', () => {
    expect(SITE_ICONS).toEqual({
      [SiteIcon.Favicon]: { path: '/favicon.ico', size: 48, mediaType: 'image/x-icon', purpose: IconPurpose.Any },
      [SiteIcon.Vector]: { path: '/icon.svg', size: null, mediaType: 'image/svg+xml', purpose: IconPurpose.Any },
      [SiteIcon.AppleTouch]: { path: '/apple-touch-icon.png', size: 180, mediaType: 'image/png', purpose: IconPurpose.Any },
      [SiteIcon.Icon192]: { path: '/icon-192.png', size: 192, mediaType: 'image/png', purpose: IconPurpose.Any },
      [SiteIcon.Icon512]: { path: '/icon-512.png', size: 512, mediaType: 'image/png', purpose: IconPurpose.Any },
      [SiteIcon.Maskable192]: { path: '/icon-maskable-192.png', size: 192, mediaType: 'image/png', purpose: IconPurpose.Maskable },
      [SiteIcon.Maskable512]: { path: '/icon-maskable-512.png', size: 512, mediaType: 'image/png', purpose: IconPurpose.Maskable },
    });
  });

  test('the purposes are the two the manifest accepts', () => {
    expect(Object.values(IconPurpose)).toEqual(['any', 'maskable']);
  });

  test('the Open Graph image is the 1200 by 630 share card', () => {
    expect(OPEN_GRAPH_IMAGE).toMatchObject({ path: '/og/todz.png', width: 1200, height: 630, mediaType: 'image/png' });
    expect(OPEN_GRAPH_IMAGE.alt.length).toBeGreaterThan(0);
  });
});
