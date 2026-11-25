import { createExecutionContext } from 'cloudflare:test';
import { exports } from 'cloudflare:workers';
import { MILLISECONDS_PER_SECOND, WAITLIST_MINIMUM_FILL_MS } from '@todz/types';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { MCP_COPY } from '../src/mcp-copy';
import { LANDING_COPY } from '../src/site/landing-copy';
import { LandingNotice, PAGE_SCRIPT, serveLandingPage } from '../src/site/landing-page';
import { serveSite } from '../src/site/site-endpoint';
import { LANDING_SHOTS, LandingShot } from '../src/site/landing-shots';
import { SITE_STYLE } from '../src/site/site-style';
import { StampVerdict, stampVerdictOf } from '../src/site/waitlist-stamp';
import { TURNSTILE_DUMMY_TOKEN } from '../src/turnstile';
import { TURNSTILE_TEST_SECRET } from './email-sign-in-client';
import { workerEnvWith } from './owner-client';
import { TEST_SITE_KEY, inlineSources, onlyInlineSource, sourceHash } from './page-script';
import { joinStampOf, withoutStamps } from './waitlist-client';

const OK_STATUS = 200;
const TOO_MANY_STATUS = 429;
const RETRY_AFTER_SECONDS = '60';
const UNUSABLE_SITE_KEY = 'key"><script>';
const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';
const TURNSTILE_SCRIPT_TAG = '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>';
const FAILURE_CALLBACK = 'waitlistChallengeFailed';
const EXPIRED_CALLBACK = 'waitlistTokenExpired';
const FAILURE_CALLBACK_ATTRIBUTES = ['data-error-callback', 'data-timeout-callback'];
const widgetHtmlOf = (form: string) =>
  `<div class="cf-turnstile" data-sitekey="${TEST_SITE_KEY}" data-action="waitlist" data-appearance="always" data-size="flexible" data-theme="auto" data-callback="waitlistTokenReady" data-error-callback="${FAILURE_CALLBACK}_${form}" data-expired-callback="${EXPIRED_CALLBACK}" data-timeout-callback="${FAILURE_CALLBACK}_${form}"></div>`;
const WIDGET_PATTERN = /<div class="cf-turnstile"[^>]*><\/div>/g;
const CAPSULE_END = '</button>\n</div>';
const NOTICE_PATTERN = /<p id="([a-z]+)-notice" [^>]*role="status"[^>]*tabindex="-1"[^>]*>[\s\S]*?<\/span>([^<]*)<\/p>/;
const NOTICES = [LandingNotice.None, LandingNotice.OpensSoon, LandingNotice.Joined, LandingNotice.TryAgain];
const SHOWN_NOTICES = [
  { notice: LandingNotice.OpensSoon, text: 'The waitlist opens soon.' },
  { notice: LandingNotice.Joined, text: "You're on the list. Check your inbox." },
  { notice: LandingNotice.TryAgain, text: "Couldn't add you right now. Try again in a minute." },
];
const LOCAL_SITE_ORIGIN = 'http://localhost:8788';
const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA';
const TOKEN_FIELD = 'cf-turnstile-response';
const FORM_CONTENT_TYPE = 'application/x-www-form-urlencoded';
const HTML_CONTENT_TYPE = 'text/html; charset=utf-8';
const STRICT_TRANSPORT_SECURITY = 'max-age=31536000';
const SCRIPT_PATTERN = /<script>([\s\S]*?)<\/script>/g;
const STYLE_PATTERN = /<style>([\s\S]*?)<\/style>/g;
const SVG_PATTERN = /<svg[\s\S]*?<\/svg>/g;
const TAG_PATTERN = /<[^>]*>/g;
const TERMINAL_WORD_PATTERN = /<span class="terminal-word">([^<]*)<\/span>/g;
const FORM_PATTERN = /<form[\s\S]*?<\/form>/g;
const STYLE_ATTRIBUTE_PATTERN = /<[^>]*\sstyle=/;
const EVENT_HANDLER_PATTERN = /<[^>]*\son[a-z]+=/;
const READABLE_ATTRIBUTE_PATTERN = /\s(?:alt|aria-label|placeholder|data-submitting)="([^"]*)"/g;
const DESCRIPTION_PATTERN = /<meta name="description" content="([^"]*)">/g;
const IMAGE_SOURCE_PATTERN = /\s(?:src|srcset)="([^"]*)"/g;
const REMOTE_ASSET_PATTERNS = [/\s(?:src|srcset)="https?:/, /<link(?![^>]*rel="canonical")[^>]*\shref="https?:/, /url\(\s*['"]?https?:/];
const HREF_PATTERN = /\shref="([^"]*)"/g;
const SITE_HREF_PATTERN = /^(?:\/|#|https:\/\/)/;
const IMPORT_PATTERN = /from '([^']+)'/g;
const LOCAL_ORIGIN_MODULE = 'local-origin';
const LOCAL_ORIGIN_IMPORT_PATTERN = /import ([^;]+?) from '[^']*local-origin'/g;
const SITE_HOST_PREDICATE_IMPORT = '{ isLocalSiteHost }';
const LANDING_ASSET_PREFIX = '/landing/';
const DOCS_SELF_HOST_URL = 'https://docs.todz.app/self-host';
const GUIDE_LINK_PATTERN = /<a class="(?:nav-link|footer-link)" href="([^"]*)"/g;
const FOOTER_CREDIT =
  '<p class="footer-credit">todz is a product of <a class="footer-credit-link" href="https://logicbit.com.br" rel="noopener noreferrer">Logic Bit</a>, made in Brazil</p>';
const FOOTER_CREDIT_LINK_STYLE = '.footer-credit-link{color:var(--color-text);text-decoration:underline;text-underline-offset:0.2em}';
const SECTION_MARKERS = [
  '<section class="hero',
  '<section class="benefits',
  '<section class="how-it-works',
  '<section class="final-call',
  '<footer class="site-footer',
];
const JOIN_FORMS = [
  { id: 'join', action: '/join#join' },
  { id: 'final', action: '/join#final' },
];
const SITE_SOURCES = import.meta.glob('../src/site/**/*.ts', { query: '?raw', import: 'default', eager: true });

type SitePage = { response: Response; html: string };

type NamedPage = [string, () => Promise<SitePage>];

async function pageOf(response: Promise<Response>): Promise<SitePage> {
  const answer = await response;
  return { response: answer, html: await answer.text() };
}

function landingPage(notice: LandingNotice): Promise<SitePage> {
  return pageOf(serveLandingPage({ notice, challenge: null }));
}

function widgetLandingPage(notice: LandingNotice): Promise<SitePage> {
  return pageOf(serveLandingPage({ notice, challenge: { siteKey: TEST_SITE_KEY, stampSecret: TURNSTILE_TEST_SECRET } }));
}

const LANDING_PAGES: NamedPage[] = NOTICES.map((notice) => [`the landing with the ${notice} notice`, () => landingPage(notice)]);
const WIDGET_LANDING_PAGES: NamedPage[] = NOTICES.map((notice) => [
  `the landing with the ${notice} notice and the widget`,
  () => widgetLandingPage(notice),
]);

function pageScriptOf(html: string): string {
  const [pageScript] = inlineSources({ html, pattern: SCRIPT_PATTERN });
  if (pageScript === undefined) throw new Error('the page has a page script');
  return pageScript;
}

function formsOf(html: string): string[] {
  return [...html.matchAll(FORM_PATTERN)].map(([form]) => form);
}

async function landingPolicy({ html, widgetOrigins }: { html: string; widgetOrigins: string[] }): Promise<string> {
  const structuredDataHash = await sourceHash(onlyInlineSource({ html, pattern: STRUCTURED_DATA_PATTERN }));
  const scriptHashes = await Promise.all(inlineSources({ html, pattern: SCRIPT_PATTERN }).map((script) => sourceHash(script)));
  const styleHash = await sourceHash(onlyInlineSource({ html, pattern: STYLE_PATTERN }));
  return [
    "default-src 'none'",
    ['script-src', structuredDataHash, ...scriptHashes, ...widgetOrigins].join(' '),
    `style-src ${styleHash}`,
    "img-src 'self'",
    "manifest-src 'self'",
    "connect-src 'self'",
    ...widgetOrigins.map((origin) => `frame-src ${origin}`),
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
  ].join('; ');
}

function decoded(text: string): string {
  return text.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&amp;', '&');
}

function copyStrings(copy: object): string[] {
  return Object.values(copy).flatMap((value) => (typeof value === 'string' ? [value] : copyStrings(value)));
}

function textNodes(html: string): string[] {
  return html
    .replace(TERMINAL_WORD_PATTERN, '$1')
    .replace(SCRIPT_PATTERN, '')
    .replace(STRUCTURED_DATA_PATTERN, '')
    .replace(STYLE_PATTERN, '')
    .replace(SVG_PATTERN, '')
    .split(TAG_PATTERN)
    .map((text) => decoded(text.trim()))
    .filter((text) => text.length > 0);
}

function captures({ html, pattern }: { html: string; pattern: RegExp }): string[] {
  return [...html.matchAll(pattern)].flatMap((match) => match.slice(1, 2));
}

describe('the site pages', () => {
  test.each([...LANDING_PAGES, ...WIDGET_LANDING_PAGES])(
    '%s answers HTML with HSTS for this host only, nosniff and a referrer policy',
    async (_name, page) => {
      const { response } = await page();
      expect(response.status).toBe(OK_STATUS);
      expect(response.headers.get('Content-Type')).toBe(HTML_CONTENT_TYPE);
      expect(response.headers.get('Strict-Transport-Security')).toBe(STRICT_TRANSPORT_SECURITY);
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('Referrer-Policy')).toBeTruthy();
    },
  );

  test.each(LANDING_PAGES)(
    '%s has no style attribute, no style inside an SVG, no event handler and no remote asset',
    async (_name, page) => {
      const { html } = await page();
      const svgs = [...html.matchAll(SVG_PATTERN)].map(([svg]) => svg);
      expect(html).not.toMatch(STYLE_ATTRIBUTE_PATTERN);
      expect(html).not.toMatch(EVENT_HANDLER_PATTERN);
      expect(svgs.filter((svg) => svg.includes('<style'))).toEqual([]);
      expect(REMOTE_ASSET_PATTERNS.filter((pattern) => pattern.test(html))).toEqual([]);
    },
  );

  test.each(NOTICES)(
    'the landing with the %s notice and the widget has no style attribute and loads only the Turnstile script, once',
    async (notice) => {
      const { html } = await widgetLandingPage(notice);
      const [beforeScript, ...afterScripts] = html.split(TURNSTILE_SCRIPT_TAG);
      const withoutScript = [beforeScript, ...afterScripts].join('');
      expect(afterScripts).toHaveLength(1);
      expect(html).not.toMatch(STYLE_ATTRIBUTE_PATTERN);
      expect(html).not.toMatch(EVENT_HANDLER_PATTERN);
      expect(REMOTE_ASSET_PATTERNS.filter((pattern) => pattern.test(withoutScript))).toEqual([]);
    },
  );

  test.each(LANDING_PAGES)('%s credits Logic Bit in the footer with a link to its website', async (_name, page) => {
    const { html } = await page();
    const footer = html.slice(html.indexOf('<footer class="site-footer'));
    expect(footer).toContain(FOOTER_CREDIT);
  });

  test('the credit link is underlined, so it reads as a link without relying on colour', () => {
    expect(SITE_STYLE).toContain(FOOTER_CREDIT_LINK_STYLE);
  });

  test('the site imports only the site host predicate from local-origin', () => {
    const sources = Object.values(SITE_SOURCES);
    const localOriginPaths = sources
      .flatMap((source) => captures({ html: source, pattern: IMPORT_PATTERN }))
      .filter((path) => path.endsWith(LOCAL_ORIGIN_MODULE));
    const clauses = sources.flatMap((source) => captures({ html: source, pattern: LOCAL_ORIGIN_IMPORT_PATTERN }));
    expect(sources.length).toBeGreaterThan(0);
    expect(clauses).toHaveLength(localOriginPaths.length);
    expect(clauses.filter((clause) => clause !== SITE_HOST_PREDICATE_IMPORT)).toEqual([]);
  });
});

describe('the landing', () => {
  test.each(NOTICES)(
    'with the %s notice, the content security policy allows its scripts and one style by hash, its own images and its own forms',
    async (notice) => {
      const { response, html } = await landingPage(notice);
      const policy = response.headers.get('Content-Security-Policy');
      expect(policy).toBe(await landingPolicy({ html, widgetOrigins: [] }));
      expect(policy).not.toContain('unsafe-inline');
      expect(policy).not.toContain(TURNSTILE_ORIGIN);
    },
  );

  test.each(NOTICES)(
    'with the %s notice and the widget, the content security policy also allows the Turnstile script and frame',
    async (notice) => {
      const { response, html } = await widgetLandingPage(notice);
      const policy = response.headers.get('Content-Security-Policy');
      expect(policy).toBe(await landingPolicy({ html, widgetOrigins: [TURNSTILE_ORIGIN] }));
      expect(policy).not.toContain('unsafe-inline');
    },
  );

  test('the widget keeps the page script and the WebMCP script of the landing without it', async () => {
    const withoutWidget = await landingPage(LandingNotice.None);
    const withWidget = await widgetLandingPage(LandingNotice.None);
    expect(inlineSources({ html: withWidget.html, pattern: SCRIPT_PATTERN })).toHaveLength(2);
    expect(inlineSources({ html: withWidget.html, pattern: SCRIPT_PATTERN })).toEqual(
      inlineSources({ html: withoutWidget.html, pattern: SCRIPT_PATTERN }),
    );
  });

  test('shows the hero, the benefits, how it works, the final call and the footer, in that order', async () => {
    const { html } = await landingPage(LandingNotice.None);
    const positions = SECTION_MARKERS.map((marker) => html.indexOf(marker));
    expect(positions.filter((position) => position < 0)).toEqual([]);
    expect(positions).toEqual([...positions].sort((first, second) => first - second));
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
  });

  test.each(NOTICES)('with the %s notice and the widget, every word it shows or reads aloud comes from the copy module', async (notice) => {
    const { html } = await widgetLandingPage(notice);
    const copy = copyStrings(LANDING_COPY);
    const readable = [
      ...textNodes(html),
      ...captures({ html, pattern: READABLE_ATTRIBUTE_PATTERN }).map(decoded),
      ...captures({ html, pattern: DESCRIPTION_PATTERN }).map(decoded),
    ];
    expect(readable.length).toBeGreaterThan(0);
    expect(readable.filter((text) => !copy.includes(text))).toEqual([]);
  });

  test('the tool result in the terminal is the one the MCP server answers', () => {
    expect(LANDING_COPY.terminal.toolResult.startsWith(`${MCP_COPY.added} `)).toBe(true);
    expect(SITE_SOURCES['../src/site/landing-copy.ts']).toContain('MCP_COPY.added');
  });

  test.each(NOTICES)('with the %s notice, the header and footer guide links open the guide on the docs', async (notice) => {
    const { html } = await landingPage(notice);
    expect(captures({ html, pattern: GUIDE_LINK_PATTERN })).toEqual([DOCS_SELF_HOST_URL, DOCS_SELF_HOST_URL]);
  });

  test('links only to this site, a fragment or an https address', async () => {
    const { html } = await landingPage(LandingNotice.None);
    expect(captures({ html, pattern: HREF_PATTERN }).filter((href) => !SITE_HREF_PATTERN.test(href))).toEqual([]);
  });

  test('every image is served from /landing/ on this host', async () => {
    const { html } = await landingPage(LandingNotice.None);
    const sources = captures({ html, pattern: IMAGE_SOURCE_PATTERN });
    expect(sources.length).toBeGreaterThan(0);
    expect(sources.filter((source) => !source.startsWith(LANDING_ASSET_PREFIX))).toEqual([]);
  });

  test('serves every shot as WebP copies with sizes, and keeps the PNG as the fallback source', async () => {
    const { html } = await landingPage(LandingNotice.None);
    const shots = Object.entries(LANDING_SHOTS);
    shots.forEach(([, { webp }]) => {
      const srcset = webp.map(({ path, width }) => `${path} ${width}w`).join(', ');
      const sizes = `${Math.min(...webp.map(({ width }) => width))}px`;
      expect(html).toContain(`srcset="${srcset}" sizes="${sizes}"`);
    });
    const fallbackShots = shots.filter(([shot]) => shot !== LandingShot.WindowDark);
    fallbackShots.forEach(([, { path }]) => expect(html).toContain(`src="${path}" srcset="`));
  });

  test('keeps the window shot, which a phone never shows, from loading there: lazy and display none below the desktop breakpoint', async () => {
    const { html } = await landingPage(LandingNotice.None);
    const windowShot = html.match(/<div class="shot shot-window[^"]*">([\s\S]*?)<\/div>/)?.[1];
    expect(windowShot).toContain('loading="lazy"');
    expect(windowShot).not.toContain('fetchpriority');
    expect(SITE_STYLE).toContain('.shot-window{display:none;');
    expect(SITE_STYLE).not.toContain('.shot-window{visibility');
  });

  test('has the two waitlist forms, each posting to /join with the fragment that returns to it', async () => {
    const { html } = await landingPage(LandingNotice.None);
    const forms = [...html.matchAll(FORM_PATTERN)].map(([form]) => form);
    expect(forms).toHaveLength(JOIN_FORMS.length);
    JOIN_FORMS.forEach(({ id, action }, index) => {
      expect(forms[index]).toMatch(new RegExp(`^<form id="${id}"[^>]* method="post" action="${action}"`));
      expect(forms[index]).toMatch(/<input [^>]*type="email"[^>]* required/);
    });
  });

  test('without a notice, each form shows its note and no notice', async () => {
    const { html } = await landingPage(LandingNotice.None);
    const forms = [...html.matchAll(FORM_PATTERN)].map(([form]) => form);
    expect(textNodes(html)).not.toContain(LANDING_COPY.join.opensSoon);
    expect(forms.filter((form) => !form.includes(LANDING_COPY.join.note))).toEqual([]);
  });

  test.each(SHOWN_NOTICES)(
    'with the $notice notice, each form shows "$text" as its own focusable status instead of its note',
    async ({ notice, text }) => {
      const { html } = await landingPage(notice);
      const forms = formsOf(html).map(decoded);
      expect(forms.map((form) => NOTICE_PATTERN.exec(form)?.slice(1))).toEqual(JOIN_FORMS.map(({ id }) => [id, text]));
      expect(forms.filter((form) => form.includes(LANDING_COPY.join.note))).toEqual([]);
    },
  );

  test.each(NOTICES)(
    'with the %s notice and a site key, each form holds one waitlist widget between its capsule and its status',
    async (notice) => {
      const { html } = await widgetLandingPage(notice);
      const forms = formsOf(html);
      expect(forms).toHaveLength(JOIN_FORMS.length);
      expect(html.match(WIDGET_PATTERN)).toHaveLength(JOIN_FORMS.length);
      JOIN_FORMS.forEach(({ id }, index) => {
        expect(forms[index]).toContain(`${CAPSULE_END}\n<div class="join-check">${widgetHtmlOf(id)}</div>\n`);
      });
    },
  );

  test('the widget names one function for its error and timeout callbacks and another for its expiry, and the page script assigns both on window', async () => {
    const { html } = await widgetLandingPage(LandingNotice.None);
    const widget = html.match(WIDGET_PATTERN)?.[0];
    if (widget === undefined) throw new Error('the page has no widget');
    const named = FAILURE_CALLBACK_ATTRIBUTES.map((attribute) => new RegExp(`${attribute}="([^"]*)"`).exec(widget)?.[1]);
    expect(named).toEqual(FAILURE_CALLBACK_ATTRIBUTES.map(() => `${FAILURE_CALLBACK}_join`));
    expect(widget).toContain(`data-expired-callback="${EXPIRED_CALLBACK}"`);
    expect(pageScriptOf(html)).toContain(`window['${FAILURE_CALLBACK}_' + form.id] =`);
    expect(pageScriptOf(html)).toContain(`window.${EXPIRED_CALLBACK} =`);
  });

  test.each([
    ['no site key', null],
    ['an unusable site key', { siteKey: UNUSABLE_SITE_KEY, stampSecret: TURNSTILE_TEST_SECRET }],
  ])('with %s, the landing renders no widget, no Turnstile script and no Turnstile origin', async (_name, challenge) => {
    const { response, html } = await pageOf(serveLandingPage({ notice: LandingNotice.Joined, challenge }));
    expect(html).not.toMatch(WIDGET_PATTERN);
    expect(html).not.toContain(TURNSTILE_SCRIPT_TAG);
    expect(html).not.toContain(UNUSABLE_SITE_KEY);
    expect(response.headers.get('Content-Security-Policy')).not.toContain(TURNSTILE_ORIGIN);
  });
});

describe('the landing joins in place behind a stamp, a honeypot and a visible check', () => {
  const STAMP_INPUT_PATTERN = /<input [^>]*type="hidden"[^>]*name="stamp"[^>]*value="([^"]*)"/g;
  const HONEYPOT_PATTERN =
    /<div class="join-extra" aria-hidden="true">\s*<label [^>]*for="([^"]+)">[^<]+<\/label>\s*<input [^>]*id="\1"[^>]*>\s*<\/div>/;
  const HONEYPOT_INPUT_ATTRIBUTES = [
    'name="todz_fax"',
    'type="text"',
    'tabindex="-1"',
    'autocomplete="off"',
    'data-1p-ignore',
    'data-lpignore="true"',
    'data-bwignore',
    'data-form-type="other"',
  ];
  const WIDGET_ATTRIBUTES = [
    'data-appearance="always"',
    'data-size="flexible"',
    'data-theme="auto"',
    'data-action="waitlist"',
    'data-callback="waitlistTokenReady"',
    'data-error-callback="waitlistChallengeFailed_join"',
    'data-expired-callback="waitlistTokenExpired"',
    'data-timeout-callback="waitlistChallengeFailed_join"',
  ];
  const FIRST_RENDER = 1_790_000_000_000;
  const SECOND_RENDER = FIRST_RENDER + MILLISECONDS_PER_SECOND;
  const STAMP_TIME_LENGTH = 13;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function stampedLandingPage(notice: LandingNotice): Promise<SitePage> {
    return pageOf(serveLandingPage({ notice, challenge: { siteKey: TEST_SITE_KEY, stampSecret: TURNSTILE_TEST_SECRET } }));
  }

  function stampsOf(html: string): string[] {
    return [...html.matchAll(STAMP_INPUT_PATTERN)].map(([, stamp]) => {
      if (stamp === undefined) throw new Error('a stamp input has a value');
      return stamp;
    });
  }

  test.each(NOTICES)('with the %s notice, each form holds one stamp input that is patient two seconds after its render', async (notice) => {
    vi.spyOn(Date, 'now').mockReturnValue(FIRST_RENDER);
    const { html } = await stampedLandingPage(notice);
    const stamps = formsOf(html).map((form) => stampsOf(form));
    expect(stamps.map((formStamps) => formStamps.length)).toEqual(JOIN_FORMS.map(() => 1));
    const verdicts = await Promise.all(
      stamps.flat().map((stamp) => stampVerdictOf({ secret: TURNSTILE_TEST_SECRET, stamp, now: FIRST_RENDER + WAITLIST_MINIMUM_FILL_MS })),
    );
    expect(verdicts).toEqual(JOIN_FORMS.map(() => StampVerdict.Patient));
  });

  test('each form holds one aria-hidden honeypot whose labelled input is out of the tab order and the autofill', async () => {
    const { html } = await stampedLandingPage(LandingNotice.None);
    formsOf(html).forEach((form) => {
      const honeypot = HONEYPOT_PATTERN.exec(form);
      expect(honeypot).not.toBeNull();
      HONEYPOT_INPUT_ATTRIBUTES.forEach((attribute) => expect(honeypot?.[0]).toContain(attribute));
      expect(form.match(/class="join-extra"/g)).toHaveLength(1);
    });
  });

  test('each widget is always visible, flexible and automatic in theme, with the four callbacks', async () => {
    const { html } = await stampedLandingPage(LandingNotice.None);
    const widgets = html.match(WIDGET_PATTERN);
    expect(widgets).toHaveLength(JOIN_FORMS.length);
    JOIN_FORMS.forEach(({ id }, index) => {
      WIDGET_ATTRIBUTES.map((attribute) => attribute.replace('_join', `_${id}`)).forEach((attribute) =>
        expect(widgets?.[index]).toContain(attribute),
      );
    });
  });

  test('each form holds its own status line with its note, ready for the answer', async () => {
    const { html } = await stampedLandingPage(LandingNotice.None);
    const forms = formsOf(html);
    JOIN_FORMS.forEach(({ id }, index) => {
      expect(forms[index]).toMatch(new RegExp(`<p id="${id}-notice"[^>]* role="status"[^>]*>[^<]*${LANDING_COPY.join.note}</p>`));
    });
  });

  test.each([
    [LandingNotice.Joined, false],
    [LandingNotice.TryAgain, true],
    [LandingNotice.OpensSoon, true],
  ])('with the %s notice, the status dot is neutral: %s', async (notice, isNeutral) => {
    const { html } = await stampedLandingPage(notice);
    expect(formsOf(html).every((form) => form.includes('join-notice-neutral') === isNeutral)).toBe(true);
  });

  test('the neutral dot uses the muted text colour and the script applies it to every outcome but joined', () => {
    expect(SITE_STYLE).toContain('.join-notice-neutral .notice-dot{background:var(--color-text-muted);box-shadow:none}');
    expect(PAGE_SCRIPT).toContain('join-notice-neutral');
  });

  test('the script resets the widgets again when the browser comes back online', () => {
    expect(PAGE_SCRIPT).toContain("addEventListener('online'");
  });

  test('the markup carries no aria-disabled, the page script sets it', async () => {
    const { html } = await stampedLandingPage(LandingNotice.None);
    expect(html).not.toMatch(/<[^>]*\saria-disabled=/);
  });

  test('the check frame reserves the height of the widget and the final card narrows its padding on a phone', () => {
    expect(SITE_STYLE).toContain('.join-check{min-height:65px');
    expect(SITE_STYLE).toContain('.final-call{margin-top:var(--space-section);padding:var(--space-8) var(--space-4);');
    expect(SITE_STYLE).toContain('.final-call{padding-inline:var(--space-5)}');
  });

  test('the waiting button shows a blocked cursor and only the sending one a busy cursor', () => {
    expect(SITE_STYLE).toContain('.join-button[aria-disabled=true]{cursor:not-allowed');
    expect(SITE_STYLE).toContain('.join-form[data-join-state=sending] .join-button{cursor:progress');
  });

  test('a page without a challenge has no stamp, no widget and no aria-disabled', async () => {
    const { html } = await landingPage(LandingNotice.None);
    expect(stampsOf(html)).toEqual([]);
    expect(html).not.toMatch(WIDGET_PATTERN);
    expect(html).not.toMatch(/<[^>]*\saria-disabled=/);
  });

  test('no element carries an event handler attribute', async () => {
    const { html } = await stampedLandingPage(LandingNotice.None);
    expect(html).not.toMatch(EVENT_HANDLER_PATTERN);
  });

  test('two renders carry different stamps and the same policy', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIRST_RENDER);
    const first = await stampedLandingPage(LandingNotice.None);
    vi.spyOn(Date, 'now').mockReturnValue(SECOND_RENDER);
    const second = await stampedLandingPage(LandingNotice.None);
    expect(stampsOf(first.html)).toHaveLength(JOIN_FORMS.length);
    expect(stampsOf(first.html)[0]?.slice(0, STAMP_TIME_LENGTH)).toBe(String(FIRST_RENDER));
    expect(stampsOf(second.html)[0]?.slice(0, STAMP_TIME_LENGTH)).toBe(String(SECOND_RENDER));
    expect(stampsOf(first.html)).not.toEqual(stampsOf(second.html));
    expect(first.response.headers.get('Content-Security-Policy')).toBe(second.response.headers.get('Content-Security-Policy'));
  });

  test('the policy is hash based, names only the widget origin for scripts and frames and keeps connections and forms on the site', async () => {
    const { response } = await stampedLandingPage(LandingNotice.None);
    const directives = response.headers.get('Content-Security-Policy')?.split('; ');
    const scriptDirective = directives?.find((directive) => directive.startsWith('script-src '));
    expect(scriptDirective?.split(' ').filter((source) => source.startsWith("'sha256-")).length).toBeGreaterThan(0);
    expect(scriptDirective).toContain(TURNSTILE_ORIGIN);
    expect(response.headers.get('Content-Security-Policy')).not.toContain(UNSAFE_INLINE);
    expect(response.headers.get('Content-Security-Policy')).not.toContain("'unsafe-eval'");
    expect(directives).toContain(`frame-src ${TURNSTILE_ORIGIN}`);
    expect(directives).toContain(CONNECT_DIRECTIVE);
    expect(directives).toContain("form-action 'self'");
  });

  test('through the Worker with a site key and no secret, the page has no stamp and no widget', async () => {
    const request = new Request(`${LOCAL_SITE_ORIGIN}/`);
    const workerEnv = workerEnvWith({ SITE_ORIGIN: LOCAL_SITE_ORIGIN, TURNSTILE_SITE_KEY: TEST_SITE_KEY, TURNSTILE_SECRET_KEY: undefined });
    const answer = await serveSite({ request, env: workerEnv, executionContext: createExecutionContext() });
    const html = await answer.text();
    expect(stampsOf(html)).toEqual([]);
    expect(html).not.toMatch(WIDGET_PATTERN);
    expect(answer.headers.get('Content-Security-Policy')).not.toContain(TURNSTILE_ORIGIN);
  });

  test('without the secret, the page has no stamp and no widget', async () => {
    const { html } = await pageOf(serveLandingPage({ notice: LandingNotice.None, challenge: null }));
    expect(stampsOf(html)).toEqual([]);
    expect(html).not.toMatch(WIDGET_PATTERN);
  });
});

describe('the site host through the Worker', () => {
  function keyedLandingPage(notice: LandingNotice): Promise<SitePage> {
    return pageOf(serveLandingPage({ notice, challenge: { siteKey: TURNSTILE_TEST_SITE_KEY, stampSecret: TURNSTILE_TEST_SECRET } }));
  }

  async function postJoin(token: string | null): Promise<Response> {
    const fields = new URLSearchParams({ email: `${crypto.randomUUID()}@example.com`, stamp: await joinStampOf() });
    if (token !== null) fields.set(TOKEN_FIELD, token);
    const body = fields.toString();
    return exports.default.fetch(`${LOCAL_SITE_ORIGIN}/join`, {
      method: 'POST',
      headers: { 'Content-Type': FORM_CONTENT_TYPE, 'Content-Length': String(body.length) },
      body,
    });
  }

  async function expectPage({ response, expected, status }: { response: Response; expected: SitePage; status: number }): Promise<void> {
    expect(response.status).toBe(status);
    expect(withoutStamps(await response.text())).toBe(withoutStamps(expected.html));
    expect(response.headers.get('Content-Security-Policy')).toBe(expected.response.headers.get('Content-Security-Policy'));
    expect(response.headers.get('Strict-Transport-Security')).toBe(STRICT_TRANSPORT_SECURITY);
  }

  test.each([
    { method: 'GET', path: '/', page: () => keyedLandingPage(LandingNotice.None) },
    { method: 'HEAD', path: '/', page: async () => ({ ...(await keyedLandingPage(LandingNotice.None)), html: '' }) },
  ])('$method $path answers the page this module renders, with the configured site key and its headers', async ({ method, path, page }) => {
    const response = await exports.default.fetch(`${LOCAL_SITE_ORIGIN}${path}`, { method });
    await expectPage({ response, expected: await page(), status: OK_STATUS });
  });

  test('POST /join with the dummy token answers the joined landing and mails the address through the console', async () => {
    const output = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const response = await postJoin(TURNSTILE_DUMMY_TOKEN);
    await expectPage({ response, expected: await keyedLandingPage(LandingNotice.Joined), status: OK_STATUS });
    expect(output).toHaveBeenCalledTimes(1);
    output.mockRestore();
  });

  test('POST /join without a token answers the try-again landing, 429 with Retry-After 60', async () => {
    const response = await postJoin(null);
    expect(response.headers.get('Retry-After')).toBe(RETRY_AFTER_SECONDS);
    await expectPage({ response, expected: await keyedLandingPage(LandingNotice.TryAgain), status: TOO_MANY_STATUS });
  });
});

const STRUCTURED_DATA_PATTERN = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
const ATTRIBUTE_HANDLER_PATTERN = /<[^>]*\son[a-z]+=/;
const MANIFEST_DIRECTIVE = "manifest-src 'self'";
const CONNECT_DIRECTIVE = "connect-src 'self'";
const UNSAFE_INLINE = "'unsafe-inline'";
const SITE_CACHE_CONTROL = 'no-cache, no-transform';
const ADMIN_SIGN_IN_PATH = '/admin';
const ADMIN_LINK_PATH = '/admin/sign-in';

function scriptSources(policy: string | null): string[] {
  const directive = policy?.split('; ').find((entry) => entry.startsWith('script-src '));
  if (directive === undefined) return [];
  return directive.split(' ').slice(1);
}

describe('the structured data and the policy of the public pages', () => {
  const PUBLIC_PAGES: NamedPage[] = [['the landing', () => landingPage(LandingNotice.None)]];

  test.each(PUBLIC_PAGES)('%s allows its JSON-LD block by hash', async (_name, page) => {
    const { response, html } = await page();
    const block = onlyInlineSource({ html, pattern: STRUCTURED_DATA_PATTERN });
    expect(scriptSources(response.headers.get('Content-Security-Policy'))).toContain(await sourceHash(block));
  });

  test('the landing allows its page script by hash beside the JSON-LD block', async () => {
    const { response, html } = await landingPage(LandingNotice.None);
    const pageScript = pageScriptOf(html);
    expect(scriptSources(response.headers.get('Content-Security-Policy'))).toContain(await sourceHash(pageScript));
  });

  test.each(PUBLIC_PAGES)('%s allows the manifest from this origin only and is cached without transforms', async (_name, page) => {
    const { response } = await page();
    expect(response.headers.get('Content-Security-Policy')?.split('; ')).toContain(MANIFEST_DIRECTIVE);
    expect(response.headers.get('Cache-Control')).toBe(SITE_CACHE_CONTROL);
  });

  test.each(PUBLIC_PAGES)('%s lets Lighthouse read its discovery files: connections to this origin only', async (_name, page) => {
    const { response } = await page();
    const directives = response.headers.get('Content-Security-Policy')?.split('; ');
    expect(directives).toContain(CONNECT_DIRECTIVE);
    expect(directives?.filter((directive) => directive.startsWith('connect-src '))).toEqual([CONNECT_DIRECTIVE]);
  });

  test('no site page widens its policy with unsafe-inline or carries an inline handler attribute', async () => {
    const adminPages = [ADMIN_SIGN_IN_PATH, ADMIN_LINK_PATH].map((path): NamedPage => [
      path,
      () => pageOf(exports.default.fetch(`${LOCAL_SITE_ORIGIN}${path}`)),
    ]);
    const pages = [...LANDING_PAGES, ...WIDGET_LANDING_PAGES, ...adminPages];
    const answers = await Promise.all(pages.map(([, page]) => page()));
    expect(answers).toHaveLength(pages.length);
    answers.forEach(({ response, html }) => {
      expect(response.headers.get('Content-Security-Policy')).not.toContain(UNSAFE_INLINE);
      expect(html).not.toMatch(ATTRIBUTE_HANDLER_PATTERN);
    });
  });
});
