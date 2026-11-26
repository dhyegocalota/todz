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
  return html.slice(html.indexOf('<section class="hero'), html.indexOf('<section id="ways"'));
}

function waysOf(html: string): string {
  return html.slice(html.indexOf('<section id="ways"'), html.indexOf('<footer class="site-footer'));
}

describe('the free copy', () => {
  test('says Free on todz cloud, or run your own, and the hero button says Free too', () => {
    expect(LANDING_COPY.free.line).toBe('Free on todz cloud — or run your own.');
    expect(LANDING_COPY.download.heroButton).toBe('Download for Mac — Free');
  });

  test('words the two ways as the owner asked', () => {
    const { ways } = LANDING_COPY;
    expect(ways.cloud).toEqual({
      title: 'todz cloud',
      badge: 'Free',
      body: 'Sign in with your email. Synced across your Macs and agents. Nothing to run.',
      cta: 'Download for Mac',
    });
    expect(ways.selfHost).toEqual({
      title: 'Self-host',
      badge: 'Open source',
      body: 'Run the server on your own Cloudflare account. Same app: switch the server in Settings.',
      cta: 'Server setup guide',
    });
    expect(ways.note).toBe('The app is the same either way, and updates itself.');
  });

  test('promises nothing about prices, tiers or limits', () => {
    expect(JSON.stringify([LANDING_COPY.free, LANDING_COPY.ways])).not.toMatch(MONEY_PATTERN);
  });
});

describe('the free hero', () => {
  test('puts the one clear line under the promise, before the download', async () => {
    const hero = heroOf(await landingHtml());
    expect(hero.indexOf('hero-lead')).toBeLessThan(hero.indexOf('hero-free'));
    expect(hero.indexOf('hero-free')).toBeLessThan(hero.indexOf('class="download-button"'));
    expect(hero.replace(/<[^>]*>/g, '')).toContain(LANDING_COPY.free.line);
    expect(hero).toContain('<a class="hero-free-link" href="#ways">run your own</a>');
  });

  test('folds Free into the Download button, with no second button-like chip', async () => {
    const html = await landingHtml();
    const hero = heroOf(html);
    expect(hero).toContain(`<a class="download-button" href="/download" download>${LANDING_COPY.download.heroButton}</a>`);
    expect(html).not.toContain('free-chip');
    expect(SITE_STYLE).not.toContain('.free-chip');
  });
});

describe('the two ways section', () => {
  test('closes the page inside the final panel with id ways: two equal glass cards and the note under them', async () => {
    const ways = waysOf(await landingHtml());
    expect(ways).toContain('>Get todz on your Mac.</h2>');
    expect(ways).not.toContain('Two ways to use todz');
    expect(ways.match(/<li class="way-card glass/g)).toHaveLength(2);
    expect(ways.indexOf('>Get todz on your Mac.</h2>')).toBeLessThan(ways.indexOf('way-card'));
    expect(ways.indexOf('way-card')).toBeLessThan(ways.indexOf(LANDING_COPY.ways.note));
    expect(ways).toContain(LANDING_COPY.ways.note);
  });

  test('the cloud card has its Free badge and a Download for Mac button to /download', async () => {
    const ways = waysOf(await landingHtml());
    const cloud = ways.slice(ways.indexOf(LANDING_COPY.ways.cloud.title), ways.indexOf(LANDING_COPY.ways.selfHost.title));
    expect(cloud).toContain(`<span class="way-badge">${LANDING_COPY.ways.cloud.badge}</span>`);
    expect(cloud).toContain(LANDING_COPY.ways.cloud.body);
    expect(cloud).toContain(`href="/download"`);
    expect(cloud).toContain(LANDING_COPY.ways.cloud.cta);
  });

  test('the self-host card has its Open source badge and a link to the setup guide', async () => {
    const ways = waysOf(await landingHtml());
    const selfHost = ways.slice(ways.indexOf(LANDING_COPY.ways.selfHost.title));
    expect(selfHost).toContain(`<span class="way-badge">${LANDING_COPY.ways.selfHost.badge}</span>`);
    expect(selfHost).toContain(LANDING_COPY.ways.selfHost.body);
    expect(selfHost).toContain(`href="${SELF_HOST_URL}"`);
    expect(selfHost).toContain(LANDING_COPY.ways.selfHost.cta);
  });

  test('styles the section, its cards and the badge, two columns from the narrow breakpoint', () => {
    ['.way-card{', '.way-badge{'].forEach((rule) => expect(SITE_STYLE).toContain(rule));
    expect(SITE_STYLE).toContain('.way-list{grid-template-columns:repeat(2, 1fr)}');
  });
});

describe('the signature', () => {
  test('closes the final panel under the note, with the full name linking the personal website', async () => {
    const ways = waysOf(await landingHtml());
    expect(ways.indexOf(LANDING_COPY.ways.note)).toBeLessThan(ways.indexOf('class="signature"'));
    expect(ways).toContain(
      `<p class="signature">Built by a developer, for developers and AI tinkerers. — <a class="signature-link" href="https://dhyegocalota.com.br" rel="noopener">Dhyego Calota</a></p>`,
    );
  });

  test('is styled with the rounded font, a muted line, a bold name and a short rule', () => {
    expect(SITE_STYLE).toContain('.signature{');
    expect(SITE_STYLE).toContain('font-family:var(--font-rounded)');
    expect(SITE_STYLE).toContain('.signature-link{font-weight:600;color:var(--color-text)');
    expect(SITE_STYLE).toContain('.signature::before{');
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
