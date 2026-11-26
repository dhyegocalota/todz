import { REPOSITORY } from '@todz/types';
import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { exports } from 'cloudflare:workers';
import { afterEach, describe, expect, test, vi } from 'vitest';
import worker from '../src/index';
import { LANDING_COPY } from '../src/site/landing-copy';
import { serveLandingPage } from '../src/site/landing-page';
import { SITE_STYLE } from '../src/site/site-style';
import { workerEnvWith } from './owner-client';
import { inlineSources } from './page-script';

const LOCAL_SITE_ORIGIN = 'http://localhost:8788';
const API_ORIGIN = 'https://api.todz.app';
const SITE_ORIGIN = 'https://todz.app';
const OK_STATUS = 200;
const STARS = 1234;
const STARS_TEXT = '1.2k';
const STAR_PILL_PATTERN = /<a class="star-pill glass"[^>]*>[\s\S]*?<\/a>/g;
const STAR_COUNT_PATTERN = /<span class="star-count" data-stars="(\d+)">/;
const SCRIPT_PATTERN = /<script>([\s\S]*?)<\/script>/g;
const STRUCTURED_DATA_PATTERN = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/;
const FIRST_CAPTURE = 1;
const DISCOVERY_PATHS = ['/llms.txt', '/llms-full.txt'];
const COUNT_UP_MAXIMUM_MS = 600;
const MINT = '#8CF7D0';

async function landing(stars: number | null): Promise<{ html: string; policy: string | null }> {
  const response = serveLandingPage({ stars });
  return { html: await response.text(), policy: response.headers.get('Content-Security-Policy') };
}

function hrefsOf(html: string): string[] {
  return [...html.matchAll(/\shref="([^"]*)"/g)].map((match) => String(match[FIRST_CAPTURE]));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the star pill', () => {
  test('sits in the hero and the footer, each linking the repository and labelled Star on GitHub', async () => {
    const { html } = await landing(STARS);
    const pills = [...html.matchAll(STAR_PILL_PATTERN)].map(([pill]) => pill);
    expect(pills).toHaveLength(2);
    pills.forEach((pill) => {
      expect(pill).toContain(`href="${REPOSITORY.url}"`);
      expect(pill).toContain(LANDING_COPY.openSource.starLabel);
      expect(pill).toContain('<svg');
    });
    const [heroPill, footerPill] = [...html.matchAll(STAR_PILL_PATTERN)].map((match) => match.index);
    expect(heroPill).toBeLessThan(html.indexOf('<section class="benefits'));
    expect(footerPill).toBeGreaterThan(html.indexOf('<footer class="site-footer'));
  });

  test('sits beside Download for Mac in the hero', async () => {
    const { html } = await landing(STARS);
    const hero = html.slice(html.indexOf('<section class="hero'), html.indexOf('<section class="benefits'));
    expect(hero.indexOf('class="download-button"')).toBeLessThan(hero.indexOf('class="star-pill'));
    expect(hero).toContain('hero-actions');
  });

  test('shows the abbreviated count already in the markup, in tabular figures, with a star glyph the readers skip', async () => {
    const { html } = await landing(STARS);
    expect([...html.matchAll(new RegExp(STAR_COUNT_PATTERN, 'g'))].map((match) => match[FIRST_CAPTURE])).toEqual([
      String(STARS),
      String(STARS),
    ]);
    expect(html).toContain(`<span class="star-count-final">${STARS_TEXT}</span>`);
    expect(html).toContain('<span class="star-glyph" aria-hidden="true">★</span>');
    expect(SITE_STYLE).toContain('font-variant-numeric:tabular-nums');
  });

  test('shows the label and no number when GitHub gave none', async () => {
    const { html } = await landing(null);
    expect([...html.matchAll(STAR_PILL_PATTERN)]).toHaveLength(2);
    expect(html).not.toContain('class="star-count"');
    expect(html).not.toContain('class="star-glyph"');
    expect(html).toContain(LANDING_COPY.openSource.starLabel);
  });

  test('reserves the width of the final number while it counts, so nothing shifts', () => {
    expect(SITE_STYLE).toContain('.star-count{display:inline-grid');
    expect(SITE_STYLE).toContain('.star-count[data-counting] .star-count-final{visibility:hidden}');
  });

  test('glows mint on hover and stays a glass pill in light and dark', () => {
    expect(SITE_STYLE).toContain('.star-pill:hover');
    expect(SITE_STYLE.toLowerCase()).toContain('140 247 208');
    expect(MINT).toBe('#8CF7D0');
  });

  test('counts up once through the hashed page script, within 600 ms, and leaves reduced motion static', async () => {
    const { html, policy } = await landing(STARS);
    const scripts = inlineSources({ html, pattern: SCRIPT_PATTERN });
    const countUp = scripts.find((script) => script.includes('IntersectionObserver'));
    expect(countUp).toBeDefined();
    expect(countUp).toContain('prefers-reduced-motion');
    expect(countUp).toContain(`${COUNT_UP_MAXIMUM_MS}`);
    expect(countUp).not.toContain('fetch(');
    expect(policy).toContain('script-src');
    expect(html).not.toMatch(/<[^>]*\son[a-z]+=/);
  });
});

describe('the star count honesty', () => {
  test.each([[0], [1], [24]])('shows no number for %i stars, below the threshold of 25', async (stars) => {
    const { html } = await landing(stars);
    expect(html).not.toContain('class="star-count"');
    expect(html).not.toContain('class="star-glyph"');
    expect(html).toContain(LANDING_COPY.openSource.starLabel);
  });

  test.each([
    [25, '25'],
    [42, '42'],
    [1000, '1k'],
  ])('shows the live count for %i stars, from the threshold up', async (stars, text) => {
    const { html } = await landing(stars);
    expect(html).toContain(`<span class="star-count-final">${text}</span>`);
  });

  test('keeps no star count in the site source: only the live count is ever rendered', () => {
    const sources = Object.entries(import.meta.glob('../src/site/*.ts', { query: '?raw', import: 'default', eager: true }));
    const literalCount = /(?:stars|stargazers_count)\s*[:=]\s*\d/i;
    expect(sources.length).toBeGreaterThan(0);
    expect(sources.filter(([, source]) => literalCount.test(String(source))).map(([path]) => path)).toEqual([]);
  });
});

describe('the open source line and the footer links', () => {
  test('the hero says Open source · AGPL-3.0 with the repository link', async () => {
    const { html } = await landing(STARS);
    expect(html).toContain(`<a class="open-source-link" href="${REPOSITORY.url}"`);
    expect(html).toContain(LANDING_COPY.openSource.line);
    expect(LANDING_COPY.openSource.line).toBe('Open source · AGPL-3.0');
  });

  test('the footer links the license and the contributing guide', async () => {
    const { html } = await landing(STARS);
    const footer = html.slice(html.indexOf('<footer class="site-footer'));
    expect(hrefsOf(footer)).toEqual(expect.arrayContaining([REPOSITORY.licenseUrl, REPOSITORY.contributingUrl]));
    expect(footer).toContain(LANDING_COPY.openSource.license);
    expect(footer).toContain(LANDING_COPY.openSource.contributing);
  });
});

describe('the policy with the stars', () => {
  test('is the same strict policy with or without a count, hash based and with no new source', async () => {
    const withStars = await landing(STARS);
    const withoutStars = await landing(null);
    expect(withStars.policy).toBe(withoutStars.policy);
    expect(withStars.policy).not.toContain('unsafe-inline');
    expect(withStars.policy).toContain("default-src 'none'");
    expect(withStars.policy).toContain("connect-src 'self'");
    expect(withStars.policy).not.toMatch(/github|http:/);
  });
});

describe('the structured data and the discovery files', () => {
  test('the SoftwareApplication names its code repository and its license', async () => {
    const { html } = await landing(STARS);
    const structuredData = STRUCTURED_DATA_PATTERN.exec(html)?.[FIRST_CAPTURE];
    if (structuredData === undefined) throw new Error('the landing has structured data');
    const application = (JSON.parse(structuredData) as { '@graph': Record<string, unknown>[] })['@graph'].find(
      (node) => node['@type'] === 'SoftwareApplication',
    );
    expect(application?.codeRepository).toBe(REPOSITORY.url);
    expect(application?.license).toBe(REPOSITORY.licenseSpdxUrl);
  });

  test.each(DISCOVERY_PATHS)('%s names the repository and the license', async (path) => {
    const text = await (await exports.default.fetch(`${LOCAL_SITE_ORIGIN}${path}`)).text();
    expect(text).toContain(REPOSITORY.url);
    expect(text).toContain(REPOSITORY.licenseName);
  });
});

describe('the landing through the Worker', () => {
  async function landingFromWorker(githubAnswer: Response): Promise<{ response: Response; html: string }> {
    const githubOrigin = `https://github.test/${crypto.randomUUID()}`;
    const githubFetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => githubAnswer);
    const executionContext = createExecutionContext();
    const request = new Request(`${SITE_ORIGIN}/`) as Request<unknown, IncomingRequestCfProperties>;
    const response = await worker.fetch(
      request,
      workerEnvWith({ PUBLIC_ORIGIN: API_ORIGIN, SITE_ORIGIN, SIGN_IN_PROVIDER: 'fake', REPOSITORY_API_ORIGIN: githubOrigin }),
      executionContext,
    );
    await waitOnExecutionContext(executionContext);
    expect(githubFetch).toHaveBeenCalledWith(`${githubOrigin}/repos/${REPOSITORY.path}`, expect.anything());
    return { response, html: await response.text() };
  }

  test('renders the count GitHub gave in the first paint', async () => {
    const { html } = await landingFromWorker(Response.json({ stargazers_count: STARS }));
    expect(html).toContain(`<span class="star-count-final">${STARS_TEXT}</span>`);
  });

  test('renders the pill with no number when GitHub fails, and still answers 200', async () => {
    const { response, html } = await landingFromWorker(Response.json({ message: 'down' }, { status: 503 }));
    expect(response.status).toBe(OK_STATUS);
    expect(html).toContain(LANDING_COPY.openSource.starLabel);
    expect(html).not.toContain('class="star-count"');
  });
});
