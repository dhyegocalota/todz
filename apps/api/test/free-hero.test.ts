import { describe, expect, test } from 'vitest';
import { LANDING_COPY } from '../src/site/landing-copy';
import { serveLandingPage } from '../src/site/landing-page';
import { SITE_STYLE } from '../src/site/site-style';

const SELF_HOST_URL = 'https://docs.todz.app/self-host';
const STRUCTURED_DATA_PATTERN = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/;
const FIRST_CAPTURE = 1;
const MONEY_PATTERN = /\$|€|per month|\/mo|pricing|tier|limit/i;

async function landingHtml(): Promise<string> {
  return serveLandingPage({ stars: 1234 }).text();
}

function heroOf(html: string): string {
  return html.slice(html.indexOf('<section class="hero'), html.indexOf('<section class="benefits'));
}

describe('the free copy', () => {
  test('says Free on todz cloud, or run your own, and names the two options', () => {
    expect(LANDING_COPY.free.line).toBe('Free on todz cloud — or run your own.');
    expect(LANDING_COPY.free.chip).toBe('Free');
    expect(LANDING_COPY.free.cloud.title).toBe('todz cloud');
    expect(LANDING_COPY.free.cloud.body).toBe('Free, sign in with your email, synced, nothing to run.');
    expect(LANDING_COPY.free.selfHost.title).toBe('Self-host');
    expect(LANDING_COPY.free.selfHost.body).toBe('Open source (AGPL-3.0), on your own Cloudflare.');
  });

  test('promises nothing about prices, tiers or limits', () => {
    const words = JSON.stringify(LANDING_COPY.free);
    expect(words).not.toMatch(MONEY_PATTERN);
  });
});

describe('the free hero', () => {
  test('puts the one clear line under the promise, before the download', async () => {
    const hero = heroOf(await landingHtml());
    expect(hero).toContain(`<p class="hero-free`);
    expect(hero.indexOf('hero-lead')).toBeLessThan(hero.indexOf('hero-free'));
    expect(hero.indexOf('hero-free')).toBeLessThan(hero.indexOf('class="download-button"'));
    expect(hero).toContain(LANDING_COPY.free.line);
  });

  test('puts a Free chip in the glass style right after the Download button', async () => {
    const hero = heroOf(await landingHtml());
    expect(hero).toContain(`<span class="free-chip glass">${LANDING_COPY.free.chip}</span>`);
    expect(hero.indexOf('class="download-button"')).toBeLessThan(hero.indexOf('free-chip glass'));
    expect(hero.indexOf('free-chip glass')).toBeLessThan(hero.indexOf('class="star-pill'));
  });

  test('shows a strip of two options, the cloud one and the self-host one linking the guide', async () => {
    const hero = heroOf(await landingHtml());
    const strip = hero.slice(hero.indexOf('<ul class="options-strip'));
    expect(strip).toContain(LANDING_COPY.free.cloud.title);
    expect(strip).toContain(LANDING_COPY.free.cloud.body);
    expect(strip).toContain(LANDING_COPY.free.selfHost.body);
    expect(strip).toContain(`href="${SELF_HOST_URL}"`);
    expect(strip.match(/<li class="option-card/g)).toHaveLength(2);
  });

  test('styles the chip, the strip and its cards', () => {
    expect(SITE_STYLE).toContain('.free-chip{');
    expect(SITE_STYLE).toContain('.options-strip{');
    expect(SITE_STYLE).toContain('.option-card{');
  });
});

describe('the free offer in the structured data', () => {
  test('the offer costs "0" US dollars', async () => {
    const structuredData = STRUCTURED_DATA_PATTERN.exec(await landingHtml())?.[FIRST_CAPTURE];
    if (structuredData === undefined) throw new Error('the landing has structured data');
    const application = (JSON.parse(structuredData) as { '@graph': { '@type': string; offers: Record<string, unknown> }[] })['@graph'].find(
      (node) => node['@type'] === 'SoftwareApplication',
    );
    expect(application?.offers.price).toBe('0');
    expect(application?.offers.priceCurrency).toBe('USD');
  });
});
