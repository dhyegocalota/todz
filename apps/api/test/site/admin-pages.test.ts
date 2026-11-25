import { describe, expect, test } from 'vitest';
import { LANDING_COPY } from '../../src/site/landing-copy';
import { ADMIN_COPY } from '../../src/site/admin-copy';
import { serveAdminLinkPage } from '../../src/site/admin-link-page';
import { serveAdminPanel, serveAdminSignInPage } from '../../src/site/admin-page';
import { AdminField, AdminPath } from '../../src/site/admin-paths';
import { AdminNotice, ConfirmationState, type WaitlistRow, type WaitlistSummary } from '../../src/site/admin-waitlist';
import { TEST_SITE_KEY, inlineSources, onlyInlineSource, sourceHash } from '../page-script';

const OK_STATUS = 200;
const HTML_CONTENT_TYPE = 'text/html; charset=utf-8';
const NO_STORE = 'no-store';
const NOINDEX = 'noindex';
const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';
const TURNSTILE_SCRIPT_TAG = '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>';
const UNUSABLE_SITE_KEY = 'key"><script>';
const ADMIN_ACTION = 'admin_sign_in';
const SELF_CONNECTION = "connect-src 'self'";
const SCRIPT_PATTERN = /<script>([\s\S]*?)<\/script>/g;
const STYLE_PATTERN = /<style>([\s\S]*?)<\/style>/g;
const STYLE_ATTRIBUTE_PATTERN = /<[^>]*\sstyle=/;
const EVENT_HANDLER_PATTERN = /<[^>]*\son[a-z]+=/;
const WIDGET_PATTERN = /<div class="cf-turnstile"[^>]*><\/div>/g;
const FORM_PATTERN = /<form[\s\S]*?<\/form>/g;
const MAIN_PATTERN = /<main id="content"[^>]*>([\s\S]*?)<\/main>/;
const HEADING_ONE_PATTERN = /<h1[\s>]/g;
const NOSCRIPT_PATTERN = /<noscript>([\s\S]*?)<\/noscript>/;
const TITLE_PATTERN = /<title>([^<]*)<\/title>/;
const SCRIPT_TAG_PATTERN = /<script[\s>]/g;
const TOKEN = 'A'.repeat(43);
const FIRST_ADDRESS = 'ana@example.com';
const HOSTILE_ADDRESS = '"><img src=x onerror=alert(1)>@example.com';
const HOSTILE_ADDRESS_ESCAPED = '&quot;&gt;&lt;img src=x onerror=alert(1)&gt;@example.com';
const JOINED_AT = Date.UTC(2026, 10, 25, 14, 3, 27);
const JOINED_AT_DATETIME = '2026-11-25T14:03:27.000Z';
const JOINED_AT_LABEL = '2026-11-25 14:03 UTC';
const ROWS_CAP = 200;
const LINK_STATUS_ID = 'link-status';
const LINK_TITLE_ID = 'link-title';
const LINK_BODY_ID = 'link-body';
const LINK_RETRY_ID = 'link-retry';
const CREATED_STATUS = 201;
const UNAUTHORIZED_STATUS = 401;

type AdminPage = { response: Response; html: string };

type FakeElement = { hidden: boolean; textContent: string; dataset: Record<string, string> };

const NOTICE_CARDS = [
  { notice: AdminNotice.None, title: 'Sign in to the admin', hasForm: true },
  { notice: AdminNotice.TryAgain, title: 'Sign in to the admin', hasForm: true },
  { notice: AdminNotice.CheckInbox, title: 'Check your inbox', hasForm: false },
  { notice: AdminNotice.Closed, title: 'The admin is closed right now.', hasForm: false },
  { notice: AdminNotice.Forbidden, title: 'Request refused', hasForm: false },
];

async function pageOf(response: Promise<Response>): Promise<AdminPage> {
  const answer = await response;
  return { response: answer, html: await answer.text() };
}

function signInPage({ notice, siteKey }: { notice: AdminNotice; siteKey: string | null }): Promise<AdminPage> {
  return pageOf(serveAdminSignInPage({ notice, siteKey }));
}

function rowsOf(count: number): WaitlistRow[] {
  return Array.from({ length: count }, (_, index) => ({
    address: `member.${index}@example.com`,
    joinedAt: JOINED_AT - index * 1_000,
    confirmation: ConfirmationState.Sent,
  }));
}

function summaryOf(overrides: Partial<WaitlistSummary>): WaitlistSummary {
  const rows = overrides.rows === undefined ? rowsOf(3) : overrides.rows;
  return { total: rows.length, joinedLastDay: 0, failedConfirmations: 0, rows, ...overrides };
}

function panelPage(overrides: Partial<WaitlistSummary>): Promise<AdminPage> {
  return pageOf(serveAdminPanel({ summary: summaryOf(overrides) }));
}

function linkPage(): Promise<AdminPage> {
  return pageOf(serveAdminLinkPage());
}

function decoded(text: string): string {
  return text.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&amp;', '&');
}

function formsOf(html: string): string[] {
  return [...mainOf(html).matchAll(FORM_PATTERN)].map(([form]) => form);
}

function widgetsOf(html: string): string[] {
  return [...html.matchAll(WIDGET_PATTERN)].map(([widget]) => widget);
}

function onlyOf(items: string[]): string {
  const [item, ...others] = items;
  if (item === undefined || others.length > 0) throw new Error('the page has exactly one of these');
  return item;
}

function titleOf(html: string): string {
  const title = TITLE_PATTERN.exec(html)?.[1];
  if (title === undefined) throw new Error('the page has no title');
  return decoded(title);
}

function mainOf(html: string): string {
  const main = MAIN_PATTERN.exec(html)?.[1];
  if (main === undefined) throw new Error('the page has no main');
  return main;
}

function directive({ policy, name }: { policy: string; name: string }): string {
  const found = policy.split('; ').find((candidate) => candidate.startsWith(`${name} `));
  if (found === undefined) throw new Error(`the policy has no ${name}`);
  return found;
}

function policyOf(page: AdminPage): string {
  const policy = page.response.headers.get('Content-Security-Policy');
  if (policy === null) throw new Error('the page has no content security policy');
  return policy;
}

function fakeElement({ hidden }: { hidden: boolean }): FakeElement {
  return { hidden, textContent: '', dataset: {} };
}

type LinkRun = {
  steps: string[];
  elements: Record<string, FakeElement>;
  settled: () => Promise<void>;
};

function runLinkScript({ html, hash, answer }: { html: string; hash: string; answer: () => Promise<{ status: number }> }): LinkRun {
  const steps: string[] = [];
  const elements: Record<string, FakeElement> = {
    [LINK_STATUS_ID]: fakeElement({ hidden: true }),
    [LINK_TITLE_ID]: fakeElement({ hidden: false }),
    [LINK_BODY_ID]: fakeElement({ hidden: false }),
    [LINK_RETRY_ID]: fakeElement({ hidden: true }),
  };
  const location = {
    hash,
    pathname: AdminPath.LinkPage,
    replace: (address: string) => steps.push(`replace location ${address}`),
  };
  const history = { replaceState: (_state: unknown, _title: string, address: string) => steps.push(`replace state ${address}`) };
  const document = { getElementById: (id: string) => elements[id] };
  const fetcher = (address: string, init: { method: string; credentials: string; headers: Record<string, string>; body: string }) => {
    steps.push(`fetch ${init.method} ${address} ${init.credentials} ${init.body}`);
    return answer();
  };
  new Function('location', 'history', 'document', 'fetch', onlyInlineSource({ html, pattern: SCRIPT_PATTERN }))(
    location,
    history,
    document,
    fetcher,
  );
  return { steps, elements, settled: () => new Promise((resolve) => setImmediate(resolve)) };
}

describe('every admin page', () => {
  const PAGES: [string, () => Promise<AdminPage>][] = [
    ...NOTICE_CARDS.map(({ notice }): [string, () => Promise<AdminPage>] => [
      `the sign-in page with the ${notice} notice`,
      () => signInPage({ notice, siteKey: null }),
    ]),
    ['the sign-in page with the widget', () => signInPage({ notice: AdminNotice.None, siteKey: TEST_SITE_KEY })],
    ['the panel', () => panelPage({})],
    ['the empty panel', () => panelPage({ total: 0, rows: [] })],
    ['the link page', linkPage],
  ];

  test.each(PAGES)('%s answers HTML that is never stored and never indexed, with the site headers', async (_name, page) => {
    const { response } = await page();
    expect(response.status).toBe(OK_STATUS);
    expect(response.headers.get('Content-Type')).toBe(HTML_CONTENT_TYPE);
    expect(response.headers.get('Cache-Control')).toBe(NO_STORE);
    expect(response.headers.get('X-Robots-Tag')).toBe(NOINDEX);
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(response.headers.get('Strict-Transport-Security')).toBeTruthy();
  });

  test.each(PAGES)('%s has no style attribute and no event handler', async (_name, page) => {
    const { html } = await page();
    expect(html).not.toMatch(STYLE_ATTRIBUTE_PATTERN);
    expect(html).not.toMatch(EVENT_HANDLER_PATTERN);
  });

  test.each(PAGES)('%s allows its one style, and each inline script, by hash and nothing unsafe', async (_name, page) => {
    const { html } = await page();
    const policy = policyOf(await page());
    const scripts = inlineSources({ html, pattern: SCRIPT_PATTERN });
    const scriptSources = policy
      .split('; ')
      .filter((candidate) => candidate.startsWith('script-src '))
      .flatMap((candidate) => candidate.split(' '));
    const scriptHashes = await Promise.all(scripts.map(sourceHash));
    expect(directive({ policy, name: 'style-src' })).toBe(
      `style-src ${await sourceHash(onlyInlineSource({ html, pattern: STYLE_PATTERN }))}`,
    );
    expect(scriptHashes.filter((hash) => !scriptSources.includes(hash))).toEqual([]);
    expect(scriptSources.filter((source) => source.startsWith("'sha256-"))).toHaveLength(scripts.length);
    expect(policy).not.toContain('unsafe-inline');
    expect(policy).not.toContain('unsafe-eval');
    expect(policy).toContain("default-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("form-action 'self'");
  });

  test.each(PAGES)('%s has one visible main, one title and a title that names the admin', async (_name, page) => {
    const { html } = await page();
    expect(html.match(/<main /g)).toHaveLength(1);
    expect(titleOf(html)).toContain('todz admin');
  });
});

describe('the sign-in page', () => {
  test.each(NOTICE_CARDS)('with the $notice notice shows "$title" as its one heading', async ({ notice, title }) => {
    const { html } = await signInPage({ notice, siteKey: null });
    const main = mainOf(html);
    expect(main.match(HEADING_ONE_PATTERN)).toHaveLength(1);
    expect(decoded(main)).toContain(`>${title}</h1>`);
  });

  test.each(NOTICE_CARDS)('with the $notice notice has a form only when it can be retried or started', async ({ notice, hasForm }) => {
    const { html } = await signInPage({ notice, siteKey: null });
    expect(formsOf(html)).toHaveLength(hasForm ? 1 : 0);
  });

  test('without a notice, asks for one address and posts it to the sign-in links route', async () => {
    const { html } = await signInPage({ notice: AdminNotice.None, siteKey: null });
    const form = onlyOf(formsOf(html));
    expect(form).toMatch(new RegExp(`^<form [^>]*method="post" action="${AdminPath.SignInLinks}"`));
    expect(form).toMatch(new RegExp(`<input [^>]*name="${AdminField.Email}"[^>]*type="email"[^>]* required`));
    expect(form).toContain(`>${ADMIN_COPY.signIn.submit}</button>`);
    expect(form).toContain(`placeholder="${LANDING_COPY.join.emailPlaceholder}"`);
    expect(form).toContain(`>${LANDING_COPY.join.emailLabel}</label>`);
    expect(html).not.toContain('class="join-notice"');
    expect(decoded(mainOf(html))).toContain(ADMIN_COPY.signIn.lead);
  });

  test('the title of each card names its state', async () => {
    const titles = await Promise.all(NOTICE_CARDS.map(async ({ notice }) => titleOf((await signInPage({ notice, siteKey: null })).html)));
    expect(titles).toEqual([
      ADMIN_COPY.meta.signInTitle,
      ADMIN_COPY.meta.signInTitle,
      ADMIN_COPY.meta.inboxTitle,
      ADMIN_COPY.meta.closedTitle,
      ADMIN_COPY.meta.refusedTitle,
    ]);
  });

  test('with the try-again notice shows the refusal as a focusable status inside the form and keeps the field empty', async () => {
    const { html } = await signInPage({ notice: AdminNotice.TryAgain, siteKey: null });
    const form = onlyOf(formsOf(html));
    expect(decoded(form)).toMatch(
      /<p [^>]*class="join-notice"[^>]*role="status"[^>]*tabindex="-1"[^>]*data-answer[^>]*>[\s\S]*?<\/span>Couldn't send a link right now\. Try again in a minute\.<\/p>/,
    );
    expect(form).not.toMatch(/<input [^>]*value=/);
  });

  test('with the check-inbox notice says the link works once, for 15 minutes, in this browser, and offers the way back', async () => {
    const { html } = await signInPage({ notice: AdminNotice.CheckInbox, siteKey: TEST_SITE_KEY });
    const main = decoded(mainOf(html));
    expect(main).toContain('If that address can sign in, a link is on its way. It works once, for 15 minutes, in this browser.');
    expect(main).toMatch(new RegExp(`<a [^>]*href="${AdminPath.Panel}"[^>]*>Back to sign in</a>`));
    expect(main).toMatch(/<h1 [^>]*data-answer[^>]*tabindex="-1"/);
    expect(widgetsOf(html)).toEqual([]);
  });

  test('with the closed notice says only that the admin is closed, with no form and no link', async () => {
    const { html } = await signInPage({ notice: AdminNotice.Closed, siteKey: TEST_SITE_KEY });
    const main = mainOf(html);
    expect(main).not.toContain('<a ');
    expect(main).not.toContain('<form');
    expect(widgetsOf(main)).toEqual([]);
    expect(main).toMatch(/<h1 [^>]*data-answer/);
  });

  test('with the forbidden notice says the request did not come from this site and offers the way back', async () => {
    const { html } = await signInPage({ notice: AdminNotice.Forbidden, siteKey: null });
    const main = decoded(mainOf(html));
    expect(main).toContain("That request didn't come from this site.");
    expect(main).toMatch(new RegExp(`<a [^>]*href="${AdminPath.Panel}"[^>]*>Back to sign in</a>`));
  });

  test.each([AdminNotice.None, AdminNotice.TryAgain])(
    'with the %s notice and a site key, holds one interaction-only widget for the admin action and loads the Turnstile script once',
    async (notice) => {
      const { response, html } = await signInPage({ notice, siteKey: TEST_SITE_KEY });
      const widget = onlyOf(widgetsOf(html));
      expect(widget).toContain(`data-sitekey="${TEST_SITE_KEY}"`);
      expect(widget).toContain(`data-action="${ADMIN_ACTION}"`);
      expect(widget).toContain('data-appearance="interaction-only"');
      expect(html.split(TURNSTILE_SCRIPT_TAG)).toHaveLength(2);
      expect(response.headers.get('Content-Security-Policy')).toContain(`frame-src ${TURNSTILE_ORIGIN}`);
      expect(directive({ policy: policyOf({ response, html }), name: 'script-src' })).toContain(TURNSTILE_ORIGIN);
    },
  );

  test.each([
    ['no site key', null],
    ['an unusable site key', UNUSABLE_SITE_KEY],
  ])('with %s renders no widget, no Turnstile script and no Turnstile origin', async (_name, siteKey) => {
    const page = await signInPage({ notice: AdminNotice.None, siteKey });
    expect(widgetsOf(page.html)).toEqual([]);
    expect(page.html).not.toContain(TURNSTILE_SCRIPT_TAG);
    expect(page.html).not.toContain(UNUSABLE_SITE_KEY);
    expect(policyOf(page)).not.toContain(TURNSTILE_ORIGIN);
  });

  test('its script is the same for the widget and without it, and its callback name is not the waitlist one', async () => {
    const withoutWidget = await signInPage({ notice: AdminNotice.None, siteKey: null });
    const withWidget = await signInPage({ notice: AdminNotice.None, siteKey: TEST_SITE_KEY });
    const script = onlyInlineSource({ html: withWidget.html, pattern: SCRIPT_PATTERN });
    expect(script).toBe(onlyInlineSource({ html: withoutWidget.html, pattern: SCRIPT_PATTERN }));
    expect(script).not.toContain('waitlistTokenReady');
    expect(withWidget.html).toMatch(/data-callback="adminTokenReady"/);
    expect(script).toContain('adminTokenReady');
  });

  test('allows no connection of its own', async () => {
    const page = await signInPage({ notice: AdminNotice.None, siteKey: TEST_SITE_KEY });
    expect(policyOf(page)).not.toContain('connect-src');
  });
});

describe('the panel', () => {
  test('shows the three counts, grouped, under their labels', async () => {
    const { html } = await panelPage({ total: 1284, joinedLastDay: 37, failedConfirmations: 2 });
    const tiles = [...mainOf(html).matchAll(/<div class="stat-tile[^"]*"><dt>([^<]*)<\/dt><dd>([^<]*)<\/dd><\/div>/g)].map(
      ([, label, value]) => [label, value],
    );
    expect(tiles).toEqual([
      [ADMIN_COPY.stats.total, '1,284'],
      [ADMIN_COPY.stats.recent, '37'],
      [ADMIN_COPY.stats.failed, '2'],
    ]);
  });

  test('has one h1 and two hidden headings, for the summary and the addresses', async () => {
    const { html } = await panelPage({});
    const main = mainOf(html);
    expect(main.match(HEADING_ONE_PATTERN)).toHaveLength(1);
    expect(main).toContain(`>${ADMIN_COPY.panel.title}</h1>`);
    expect(main).toContain(`<h2 class="visually-hidden">${ADMIN_COPY.panel.summaryHeading}</h2>`);
    expect(main).toContain(`<h2 class="visually-hidden">${ADMIN_COPY.panel.tableHeading}</h2>`);
  });

  test('offers the CSV as a download link and sign out as a post', async () => {
    const { html } = await panelPage({});
    const main = mainOf(html);
    expect(main).toMatch(new RegExp(`<a [^>]*href="${AdminPath.Export}"[^>]* download[^>]*>${ADMIN_COPY.panel.download}</a>`));
    const form = onlyOf(formsOf(html));
    expect(form).toMatch(new RegExp(`^<form [^>]*method="post" action="${AdminPath.SignOut}"`));
    expect(form).toContain(`>${ADMIN_COPY.panel.signOut}</button>`);
  });

  test('lists each row as a table row with its address, its time and its confirmation, newest first as given', async () => {
    const rows: WaitlistRow[] = [
      { address: FIRST_ADDRESS, joinedAt: JOINED_AT, confirmation: ConfirmationState.Sent },
      { address: 'bo@example.org', joinedAt: JOINED_AT - 60_000, confirmation: ConfirmationState.Failed },
    ];
    const { html } = await panelPage({ rows, total: 2, failedConfirmations: 1 });
    const bodyRows = [...mainOf(html).matchAll(/<tr [^>]*>[\s\S]*?<\/tr>/g)]
      .map(([row]) => row)
      .filter((row) => row.includes('scope="row"'));
    expect(bodyRows).toHaveLength(2);
    expect(bodyRows[0]).toContain(`>${FIRST_ADDRESS}</th>`);
    expect(bodyRows[0]).toContain(`<time datetime="${JOINED_AT_DATETIME}">${JOINED_AT_LABEL}</time>`);
    expect(bodyRows[0]).toContain(ADMIN_COPY.table.sent);
    expect(bodyRows[0]).not.toContain(ADMIN_COPY.table.failed);
    expect(bodyRows[1]).toContain('>bo@example.org</th>');
    expect(bodyRows[1]).toContain('2026-11-25 14:02 UTC');
    expect(bodyRows[1]).toContain(ADMIN_COPY.table.failed);
  });

  test('marks Sent and Failed by their word and a differently shaped badge, never by colour alone', async () => {
    const rows: WaitlistRow[] = [
      { address: FIRST_ADDRESS, joinedAt: JOINED_AT, confirmation: ConfirmationState.Sent },
      { address: 'bo@example.org', joinedAt: JOINED_AT, confirmation: ConfirmationState.Failed },
    ];
    const { html } = await panelPage({ rows, total: 2 });
    const badges = [
      ...mainOf(html).matchAll(/<span class="(badge[^"]*)">(?:<span class="badge-dot" aria-hidden="true"><\/span>)([^<]*)<\/span>/g),
    ].map(([, className, label]) => [className, label]);
    expect(badges).toEqual([
      ['badge badge-sent', ADMIN_COPY.table.sent],
      ['badge badge-failed', ADMIN_COPY.table.failed],
    ]);
  });

  test('gives the table a caption, column headers, and explicit roles that survive the stacked layout', async () => {
    const { html } = await panelPage({});
    const main = mainOf(html);
    expect(main).toContain(`<caption class="visually-hidden">${ADMIN_COPY.table.caption}</caption>`);
    [ADMIN_COPY.table.address, ADMIN_COPY.table.joined, ADMIN_COPY.table.confirmation].forEach((heading) =>
      expect(main).toContain(`<th scope="col" role="columnheader">${heading}</th>`),
    );
    ['table', 'rowgroup', 'row', 'rowheader', 'cell'].forEach((role) => expect(main).toContain(`role="${role}"`));
  });

  test('escapes every address, so a hostile one is text and never markup', async () => {
    const rows: WaitlistRow[] = [{ address: HOSTILE_ADDRESS, joinedAt: JOINED_AT, confirmation: ConfirmationState.Sent }];
    const { html } = await panelPage({ rows, total: 1 });
    expect(html).toContain(HOSTILE_ADDRESS_ESCAPED);
    expect(html).not.toContain(HOSTILE_ADDRESS);
    expect(html).not.toMatch(/<img /);
  });

  test('shows no note when every row is shown', async () => {
    const { html } = await panelPage({ rows: rowsOf(ROWS_CAP), total: ROWS_CAP });
    expect(html).not.toContain('The CSV has all.');
  });

  test('says "Showing the newest 200 of 1,284. The CSV has all." above the cap', async () => {
    const { html } = await panelPage({ rows: rowsOf(ROWS_CAP), total: 1284 });
    expect(mainOf(html)).toContain('Showing the newest 200 of 1,284. The CSV has all.');
  });

  test('with no rows shows the empty card, the zero counts, no table and still the download', async () => {
    const { html } = await panelPage({ total: 0, rows: [] });
    const main = mainOf(html);
    expect(main).not.toContain('<table');
    expect(main).toContain(`>${ADMIN_COPY.empty.title}</h2>`);
    expect(main).toContain(ADMIN_COPY.empty.body);
    expect(main).toContain(`<dd>0</dd>`);
    expect(main).toContain(`href="${AdminPath.Export}"`);
  });

  test('runs no script of its own and calls no other origin', async () => {
    const page = await panelPage({});
    expect([...page.html.matchAll(SCRIPT_TAG_PATTERN)]).toHaveLength(0);
    expect(policyOf(page)).not.toContain('connect-src');
    expect(policyOf(page)).not.toContain(TURNSTILE_ORIGIN);
  });
});

describe('the link page', () => {
  test('is the same page for every request, with no token in it', async () => {
    const first = await linkPage();
    const second = await linkPage();
    expect(first.html).toBe(second.html);
    expect(first.html).not.toContain(TOKEN);
  });

  test('allows its one script to connect to its own origin, which no other admin page may', async () => {
    const page = await linkPage();
    expect(policyOf(page)).toContain(SELF_CONNECTION);
    expect(directive({ policy: policyOf(page), name: 'connect-src' })).toBe(SELF_CONNECTION);
  });

  test('is a hidden live region the script reveals, with the failed text ready and the link to a new one hidden', async () => {
    const { html } = await linkPage();
    const main = mainOf(html);
    expect(main).toMatch(new RegExp(`<div id="${LINK_STATUS_ID}"[^>]*role="status"[^>]*aria-live="polite"[^>]*data-answer[^>]*hidden`));
    expect(main).toMatch(
      new RegExp(`<a id="${LINK_RETRY_ID}"[^>]*href="${AdminPath.Panel}"[^>]*hidden[^>]*>${ADMIN_COPY.link.failedAction}</a>`),
    );
    expect(decoded(main)).toContain(`>${ADMIN_COPY.link.working}</h1>`);
    expect(html).toContain('<title>Signing in · todz admin</title>');
  });

  test('tells a browser without scripts to turn them on, with its own heading', async () => {
    const { html } = await linkPage();
    const noScript = NOSCRIPT_PATTERN.exec(mainOf(html))?.[1];
    if (noScript === undefined) throw new Error('the page has no noscript');
    expect(noScript).toContain(`>${ADMIN_COPY.link.noScriptTitle}</h1>`);
    expect(noScript).toContain(ADMIN_COPY.link.noScript);
  });

  test('removes the fragment from the address before it posts the token, once, same-origin, as JSON', async () => {
    const { html } = await linkPage();
    const run = runLinkScript({ html, hash: `#token=${TOKEN}`, answer: async () => ({ status: CREATED_STATUS }) });
    await run.settled();
    expect(run.steps).toEqual([
      `replace state ${AdminPath.LinkPage}`,
      `fetch POST ${AdminPath.Sessions} same-origin ${JSON.stringify({ token: TOKEN })}`,
      `replace location ${AdminPath.Panel}`,
    ]);
    expect(run.elements[LINK_STATUS_ID]?.hidden).toBe(false);
  });

  test('shows the working state at once, with its title, while the post is out', async () => {
    const { html } = await linkPage();
    const run = runLinkScript({ html, hash: `#token=${TOKEN}`, answer: () => new Promise(() => undefined) });
    await run.settled();
    expect(run.elements[LINK_STATUS_ID]?.hidden).toBe(false);
    expect(run.elements[LINK_RETRY_ID]?.hidden).toBe(true);
    expect(run.steps).not.toContain(`replace location ${AdminPath.Panel}`);
  });

  test.each([UNAUTHORIZED_STATUS, 403, 429, 503])(
    'on a %s answer shows that the link cannot be used and offers a new one',
    async (status) => {
      const { html } = await linkPage();
      const run = runLinkScript({ html, hash: `#token=${TOKEN}`, answer: async () => ({ status }) });
      await run.settled();
      expect(run.elements[LINK_TITLE_ID]?.textContent).toBe(ADMIN_COPY.link.failedTitle);
      expect(run.elements[LINK_BODY_ID]?.textContent).toBe(ADMIN_COPY.link.failedBody);
      expect(run.elements[LINK_RETRY_ID]?.hidden).toBe(false);
      expect(run.steps.filter((step) => step.startsWith('replace location'))).toEqual([]);
    },
  );

  test('when the request throws shows the same failed state', async () => {
    const { html } = await linkPage();
    const run = runLinkScript({ html, hash: `#token=${TOKEN}`, answer: () => Promise.reject(new Error('offline')) });
    await run.settled();
    expect(run.elements[LINK_TITLE_ID]?.textContent).toBe(ADMIN_COPY.link.failedTitle);
    expect(run.elements[LINK_RETRY_ID]?.hidden).toBe(false);
  });

  test('without a token in the fragment posts nothing, clears the address and shows the failed state', async () => {
    const { html } = await linkPage();
    const run = runLinkScript({ html, hash: '', answer: async () => ({ status: CREATED_STATUS }) });
    await run.settled();
    expect(run.steps).toEqual([`replace state ${AdminPath.LinkPage}`]);
    expect(run.elements[LINK_TITLE_ID]?.textContent).toBe(ADMIN_COPY.link.failedTitle);
    expect(run.elements[LINK_RETRY_ID]?.hidden).toBe(false);
  });
});
