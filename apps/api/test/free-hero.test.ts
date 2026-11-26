import { describe, expect, test } from 'vitest';
import { LANDING_COPY } from '../src/site/landing-copy';
import { serveLandingPage } from '../src/site/landing-page';
import { SITE_STYLE } from '../src/site/site-style';
import { starPillHtml } from '../src/site/star-pill';
import { DOCS_INSTALL_URL } from '../src/site/site-urls';

const SELF_HOST_URL = 'https://docs.todz.app/self-host';
const DEPLOY_SCRIPT = 'server:deploy';
const STRUCTURED_DATA_PATTERN = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/;
const FIRST_CAPTURE = 1;
const MONEY_PATTERN = /\$|€|per month|\/mo|pricing|tier|limit/i;
const POINT_PATTERN = /<li class="way-point">([^<]*)<\/li>/g;
const TERMINAL_WORD_PATTERN = /<span class="terminal-word">([^<]*)<\/span>/g;
const WIDE_MEDIA = '@media (min-width: 64rem){';
const MOTION_MEDIA = '@media (prefers-reduced-motion: no-preference){';
const REDUCED_MOTION_MEDIA = '@media (prefers-reduced-motion: reduce){';
const STAR_STATES = [null, 0, 42, 1234];

async function landingHtml(stars: number | null = 1234): Promise<string> {
  return serveLandingPage({ stars }).text();
}

function heroOf(html: string): string {
  return html.slice(html.indexOf('<section class="hero'), html.indexOf('<section id="ways"'));
}

function waysOf(html: string): string {
  return html.slice(html.indexOf('<section id="ways"'), html.indexOf('<footer class="site-footer'));
}

function cloudCardOf(ways: string): string {
  return ways.slice(ways.indexOf('<li class="way-card way-card-cloud'), ways.indexOf('<li class="way-card glass"'));
}

function selfHostCardOf(ways: string): string {
  const start = ways.indexOf('<li class="way-card glass"');
  return ways.slice(start, ways.indexOf('</ul>', start));
}

function blockOf(style: string, media: string, nextMedia: string): string {
  return style.slice(style.indexOf(media), style.indexOf(nextMedia));
}

describe('the free copy', () => {
  test('says Free on todz cloud, or run your own, and the hero button says Free too', () => {
    expect(LANDING_COPY.free.line).toBe('Free on todz cloud — or run your own.');
    expect(LANDING_COPY.download.heroButton).toBe('Download for Mac — Free');
  });

  test('words the two ways as the owner asked, with the cloud as three points and the self-host command', () => {
    const { ways } = LANDING_COPY;
    expect(ways.cloud).toEqual({
      title: 'todz cloud',
      badge: 'Free',
      points: ['Sign in with your email.', 'Synced across your Macs and agents.', 'Nothing to run.'],
      cta: 'Download for Mac',
    });
    expect(ways.selfHost).toEqual({
      title: 'Self-host',
      badge: 'Open source',
      body: 'Run the server on your own Cloudflare account. Same app: switch the server in Settings.',
      cta: 'Server setup guide',
      terminal: {
        label: 'The deploy step of the self-host guide',
        command: `pnpm --filter @todz/api ${DEPLOY_SCRIPT}`,
        ready: 'todz server ready: https://api.example.com',
        next: '→ paste it in todz › Settings › Server',
      },
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

describe('the final panel', () => {
  test('closes the page under its heading: a primary cloud card, a self-host card and the note under them', async () => {
    const ways = waysOf(await landingHtml());
    expect(ways).toContain('>Get todz on your Mac.</h2>');
    expect(ways).not.toContain('final-icon');
    expect(ways.match(/<li class="way-card way-card-cloud glass/g)).toHaveLength(1);
    expect(ways.match(/<li class="way-card glass"/g)).toHaveLength(1);
    expect(ways.indexOf('>Get todz on your Mac.</h2>')).toBeLessThan(ways.indexOf('way-card-cloud'));
    expect(ways.indexOf('way-card-cloud')).toBeLessThan(ways.indexOf('<li class="way-card glass"'));
    expect(ways.indexOf('<li class="way-card glass"')).toBeLessThan(ways.indexOf(LANDING_COPY.ways.note));
    expect(ways).toContain(LANDING_COPY.ways.note);
  });

  test('the cloud card has its icon, Free badge, three points and a full-width Download for Mac button to /download', async () => {
    const cloud = cloudCardOf(waysOf(await landingHtml()));
    expect(cloud).toContain('<use href="#todz-icon"/>');
    expect(cloud).toContain(`<span class="way-badge way-badge-free">${LANDING_COPY.ways.cloud.badge}</span>`);
    expect([...cloud.matchAll(POINT_PATTERN)].map(([, point]) => point)).toEqual(LANDING_COPY.ways.cloud.points);
    expect(cloud).toContain(`<a class="download-button way-cta" href="/download" download>${LANDING_COPY.ways.cloud.cta}</a>`);
  });

  test('the cloud card carries the not-notarized note with its Install steps link', async () => {
    const cloud = cloudCardOf(waysOf(await landingHtml()));
    expect(cloud).toContain(`<p class="download-note">`);
    expect(cloud).toContain(`<a class="download-note-link" href="${DOCS_INSTALL_URL}">${LANDING_COPY.download.noteLink}</a>`);
  });

  test('the self-host card has its Open source badge, its body and a guide link', async () => {
    const selfHost = selfHostCardOf(waysOf(await landingHtml()));
    expect(selfHost).toContain(`<span class="way-badge">${LANDING_COPY.ways.selfHost.badge}</span>`);
    expect(selfHost).toContain(`<p class="way-body">${LANDING_COPY.ways.selfHost.body}</p>`);
    expect(selfHost).toContain(`<a class="way-link" href="${SELF_HOST_URL}">`);
    expect(selfHost).toContain(LANDING_COPY.ways.selfHost.cta);
  });

  test('the self-host terminal shows the deploy command, the ready line and the paste line', async () => {
    const selfHost = selfHostCardOf(waysOf(await landingHtml()));
    const { terminal } = LANDING_COPY.ways.selfHost;
    expect(selfHost).toContain(`<figure class="terminal way-terminal">`);
    expect(selfHost).toContain(`<figcaption class="visually-hidden">${terminal.label}</figcaption>`);
    const commandWords = [...selfHost.matchAll(TERMINAL_WORD_PATTERN)].map(([, word]) => word);
    expect(commandWords.join(' ')).toBe(terminal.command);
    expect(commandWords.join(' ')).toBe(`pnpm --filter @todz/api ${DEPLOY_SCRIPT}`);
    expect(selfHost).toContain(`<span class="terminal-line terminal-result">${terminal.ready}</span>`);
    expect(selfHost).toContain(`<span class="terminal-line terminal-result">${terminal.next}</span>`);
  });

  test.each(STAR_STATES)('the self-host card carries the star pill for %s stars', async (stars) => {
    const selfHost = selfHostCardOf(waysOf(await landingHtml(stars)));
    expect(selfHost).toContain(starPillHtml(stars));
  });

  test('the styles give the panel its two columns from the wide breakpoint, and no two equal columns', () => {
    expect(blockOf(SITE_STYLE, WIDE_MEDIA, MOTION_MEDIA)).toContain('.way-list{grid-template-columns:7fr 5fr;');
    expect(SITE_STYLE).not.toContain('.way-list{grid-template-columns:repeat(2, 1fr)}');
    ['.way-card{', '.way-card-cloud{', '.way-badge{', '.way-terminal{'].forEach((rule) => expect(SITE_STYLE).toContain(rule));
  });

  test('the cloud card glows mint through the --glow-mint token, defined once for both schemes', () => {
    expect(SITE_STYLE).toContain('--glow-mint:0 0 0 1px rgb(140 247 208 / 0.6), 0 0 40px rgb(140 247 208 / 0.35)');
    expect(SITE_STYLE.indexOf('--glow-mint:')).toBeLessThan(SITE_STYLE.indexOf('@media (prefers-color-scheme: dark)'));
    expect(SITE_STYLE).toContain('.way-card-cloud{box-shadow:var(--glass-edge), var(--glow-mint), var(--shadow-glass)}');
  });

  test('the muted texts of the panel are the text colour, so they pass AA on the wallpaper', () => {
    expect(SITE_STYLE).toContain('.way-body{flex:1;color:var(--color-text)}');
    expect(SITE_STYLE).toContain('.ways-note{margin-top:var(--space-5);color:var(--color-text);font-weight:500}');
    expect(SITE_STYLE).toContain('.way-card-cloud .download-note{margin-top:0;color:var(--color-text)}');
  });

  test('the self-host card has no chip-coloured button, and the old icon rule is gone', () => {
    expect(SITE_STYLE).not.toContain('.way-cta-secondary');
    expect(SITE_STYLE).not.toContain('.final-icon');
  });
});

describe('the signature', () => {
  test('closes the final panel as a glass note under the note, ending in the full name linking the personal website', async () => {
    const ways = waysOf(await landingHtml());
    expect(ways.indexOf(LANDING_COPY.ways.note)).toBeLessThan(ways.indexOf('class="signature glass"'));
    expect(ways).toContain(
      `<p class="signature glass"><span class="signature-line">Built by a developer, for developers and AI tinkerers.</span><span class="signature-sign">— <a class="signature-link" href="https://dhyegocalota.com.br" rel="noopener">Dhyego Calota</a><svg class="signature-swash" viewBox="0 0 120 12" aria-hidden="true" focusable="false">`,
    );
  });

  test('draws its swash with a pen stroke, and only while motion is allowed', async () => {
    const ways = waysOf(await landingHtml());
    expect(ways).toContain('<path d="M2 9 C 28 3, 52 11, 78 6 S 108 3, 118 5" pathLength="1"');
    expect(blockOf(SITE_STYLE, MOTION_MEDIA, REDUCED_MOTION_MEDIA)).toContain(
      '.signature-swash path{stroke-dasharray:1;stroke-dashoffset:1;animation:draw linear both;animation-timeline:view();animation-range:entry 40% cover 40%}',
    );
  });

  test('is a tilted glass note in the rounded font, with no rule above it', () => {
    expect(SITE_STYLE).toContain('.signature{');
    expect(SITE_STYLE).toContain('rotate:-1deg');
    expect(SITE_STYLE).toContain('font-family:var(--font-rounded)');
    expect(SITE_STYLE).toContain('.signature-link{font-weight:600;color:var(--color-text)');
    expect(SITE_STYLE).not.toContain('.signature::before{');
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
