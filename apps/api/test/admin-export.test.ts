import { MILLISECONDS_PER_HOUR, MILLISECONDS_PER_MINUTE } from '@todz/types';
import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, test } from 'vitest';
import { digestCredential } from '../src/credential-digest';
import type { Env } from '../src/env';
import { serveAdminSignInPage } from '../src/site/admin-page';
import { ADMIN_RESPONSE_HEADERS, AdminPath } from '../src/site/admin-paths';
import { serveAdminExport, waitlistCsvOf } from '../src/site/admin-export';
import { ADMIN_SESSION_LIFETIME_MS, AdminCookie } from '../src/site/admin-session';
import { openAdminSession } from '../src/site/admin-store';
import { AdminNotice, ConfirmationState, type WaitlistRow } from '../src/site/admin-waitlist';
import { joinWaitlistWithinLimit, recordConfirmationFailure } from '../src/site/waitlist-store';
import { workerEnvWith } from './owner-client';

const SITE_ORIGIN = 'https://todz.app';
const ADMIN_ADDRESS = 'hello@todz.app';
const SESSION_SECRET = 'an-admin-session-secret';
const JOINED_AT = Date.UTC(2026, 10, 25, 12, 30, 45, 123);
const HEADER_LINE = '"address","joined_at","confirmation"\r\n';
const OK_STATUS = 200;
const SEE_OTHER_STATUS = 303;
const UNAVAILABLE_STATUS = 503;
const CSV_CONTENT_TYPE = 'text/csv; charset=utf-8';
const CSV_DISPOSITION = 'attachment; filename="todz-waitlist.csv"';
const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

function rowOf({ address, confirmation = ConfirmationState.Sent }: { address: string; confirmation?: ConfirmationState }): WaitlistRow {
  return { address, joinedAt: JOINED_AT, confirmation };
}

function exportRequest({ cookie = `${AdminCookie.Session}=${SESSION_SECRET}` }: { cookie?: string | null } = {}): Request {
  const headers = cookie === null ? undefined : { Cookie: cookie };
  return new Request(`${SITE_ORIGIN}${AdminPath.Export}`, { headers });
}

function siteEnv(settings: Partial<Env> = {}): Env {
  return workerEnvWith({ SITE_ORIGIN, ADMIN_EMAIL: ADMIN_ADDRESS, ...settings });
}

async function exported({
  request = exportRequest(),
  settings = {},
}: { request?: Request; settings?: Partial<Env> } = {}): Promise<Response> {
  const executionContext = createExecutionContext();
  const response = await serveAdminExport({ request, env: siteEnv(settings), executionContext });
  await waitOnExecutionContext(executionContext);
  return response;
}

async function openSession({
  email = ADMIN_ADDRESS,
  expiresAt = Date.now() + ADMIN_SESSION_LIFETIME_MS,
}: { email?: string; expiresAt?: number } = {}): Promise<void> {
  await openAdminSession({
    database: env.DIRECTORY,
    digest: await digestCredential(SESSION_SECRET),
    email,
    now: Date.now() - MILLISECONDS_PER_MINUTE,
    expiresAt,
  });
}

function expectAdminHeaders(response: Response): void {
  Object.entries(ADMIN_RESPONSE_HEADERS).forEach(([name, value]) => expect(response.headers.get(name)).toBe(value));
}

function expectRedirectToPanel(response: Response): void {
  expect(response.status).toBe(SEE_OTHER_STATUS);
  expect(response.headers.get('Location')).toBe(AdminPath.Panel);
  expectAdminHeaders(response);
}

beforeEach(async () => {
  await env.DIRECTORY.batch([env.DIRECTORY.prepare('DELETE FROM waitlist'), env.DIRECTORY.prepare('DELETE FROM admin_sessions')]);
});

describe('the waitlist CSV', () => {
  test('an empty waitlist is the header line alone', () => {
    expect(waitlistCsvOf([])).toBe(HEADER_LINE);
  });

  test('every field is quoted, the date is ISO 8601 UTC and every line ends with CRLF', () => {
    const rows = [
      rowOf({ address: 'maria@example.com' }),
      { address: 'joao@example.com', joinedAt: JOINED_AT - MILLISECONDS_PER_HOUR, confirmation: ConfirmationState.Failed },
    ];
    expect(waitlistCsvOf(rows)).toBe(
      `${HEADER_LINE}"maria@example.com","2026-11-25T12:30:45.123Z","sent"\r\n"joao@example.com","2026-11-25T11:30:45.123Z","failed"\r\n`,
    );
  });

  test('a double quote is doubled', () => {
    expect(waitlistCsvOf([rowOf({ address: 'a"b@example.com' })])).toBe(
      `${HEADER_LINE}"a""b@example.com","2026-11-25T12:30:45.123Z","sent"\r\n`,
    );
  });

  test('a comma or a line break stays inside its quotes', () => {
    const csv = waitlistCsvOf([rowOf({ address: 'a,b@example.com' }), rowOf({ address: 'a\nb@example.com' })]);
    expect(csv).toBe(
      `${HEADER_LINE}"a,b@example.com","2026-11-25T12:30:45.123Z","sent"\r\n"a\nb@example.com","2026-11-25T12:30:45.123Z","sent"\r\n`,
    );
  });

  test.each(FORMULA_PREFIXES)('an address that starts with %j is prefixed with an apostrophe', (prefix) => {
    const address = `${prefix}cmd@example.com`;
    expect(waitlistCsvOf([rowOf({ address })])).toBe(`${HEADER_LINE}"'${address}","2026-11-25T12:30:45.123Z","sent"\r\n`);
  });

  test('a formula that holds a quote is prefixed, then its quote doubled', () => {
    const address = '=HYPERLINK("http://evil.example")@example.com';
    expect(waitlistCsvOf([rowOf({ address })])).toBe(
      `${HEADER_LINE}"'=HYPERLINK(""http://evil.example"")@example.com","2026-11-25T12:30:45.123Z","sent"\r\n`,
    );
  });

  test('an address that holds a formula character after its first is left alone', () => {
    expect(waitlistCsvOf([rowOf({ address: 'a=b+c@example.com' })])).toBe(
      `${HEADER_LINE}"a=b+c@example.com","2026-11-25T12:30:45.123Z","sent"\r\n`,
    );
  });
});

describe('the export route with a session', () => {
  test('answers the CSV of every row, newest first, with its headers, past the 200 of the panel', async () => {
    await openSession();
    const oldest = 'oldest@example.com';
    const failed = 'failed@example.com';
    await joinWaitlistWithinLimit({ database: env.DIRECTORY, address: oldest, now: JOINED_AT });
    await joinWaitlistWithinLimit({ database: env.DIRECTORY, address: failed, now: JOINED_AT + MILLISECONDS_PER_MINUTE });
    await recordConfirmationFailure({ database: env.DIRECTORY, address: failed, now: JOINED_AT + MILLISECONDS_PER_HOUR });
    await env.DIRECTORY.batch(
      Array.from({ length: 200 }, (_, index) =>
        env.DIRECTORY.prepare('INSERT INTO waitlist (address, joined_at, confirmation_claimed_at) VALUES (?1, ?2, ?2)').bind(
          `person-${index}@example.com`,
          JOINED_AT + MILLISECONDS_PER_HOUR + index,
        ),
      ),
    );
    const response = await exported();
    expect(response.status).toBe(OK_STATUS);
    expect(response.headers.get('Content-Type')).toBe(CSV_CONTENT_TYPE);
    expect(response.headers.get('Content-Disposition')).toBe(CSV_DISPOSITION);
    expectAdminHeaders(response);
    const lines = (await response.text()).split('\r\n');
    expect(lines[0]).toBe(HEADER_LINE.trimEnd());
    expect(lines).toHaveLength(1 + 202 + 1);
    expect(lines[1]).toContain('person-199@example.com');
    expect(lines.slice(-3)).toEqual([
      `"${failed}","${new Date(JOINED_AT + MILLISECONDS_PER_MINUTE).toISOString()}","failed"`,
      `"${oldest}","${new Date(JOINED_AT).toISOString()}","sent"`,
      '',
    ]);
  });

  test('a hostile address reaches the file only prefixed', async () => {
    await openSession();
    await joinWaitlistWithinLimit({ database: env.DIRECTORY, address: '=cmd|calc@example.com', now: JOINED_AT });
    expect(await (await exported()).text()).toContain('"\'=cmd|calc@example.com"');
  });
});

describe('the export route without a session redirects to the panel and exports nothing', () => {
  test('no cookie', async () => {
    await joinWaitlistWithinLimit({ database: env.DIRECTORY, address: 'maria@example.com', now: JOINED_AT });
    const response = await exported({ request: exportRequest({ cookie: null }) });
    expectRedirectToPanel(response);
    expect(await response.text()).toBe('');
  });

  test('an unknown session secret', async () => {
    await openSession();
    expectRedirectToPanel(await exported({ request: exportRequest({ cookie: `${AdminCookie.Session}=another-secret` }) }));
  });

  test('an expired session', async () => {
    await openSession({ expiresAt: Date.now() - 1 });
    expectRedirectToPanel(await exported());
  });

  test('the challenge cookie instead of the session cookie', async () => {
    await openSession();
    expectRedirectToPanel(await exported({ request: exportRequest({ cookie: `${AdminCookie.Challenge}=${SESSION_SECRET}` }) }));
  });

  test('two session cookies', async () => {
    await openSession();
    const cookie = `${AdminCookie.Session}=${SESSION_SECRET}; ${AdminCookie.Session}=${SESSION_SECRET}`;
    expectRedirectToPanel(await exported({ request: exportRequest({ cookie }) }));
  });

  test('a session after ADMIN_EMAIL is unset', async () => {
    await openSession();
    expectRedirectToPanel(await exported({ settings: { ADMIN_EMAIL: undefined } }));
  });

  test('a session after ADMIN_EMAIL changed to another address', async () => {
    await openSession();
    expectRedirectToPanel(await exported({ settings: { ADMIN_EMAIL: 'other@todz.app' } }));
  });
});

describe('the export route when the directory fails', () => {
  test('answers the closed card, 503, with the admin headers and no rows', async () => {
    await openSession();
    const failingDirectory = new Proxy(env.DIRECTORY, {
      get(target, property) {
        if (property === 'prepare') {
          return (statement: string) => {
            if (statement.includes('FROM waitlist')) throw new Error('the directory is down');
            return target.prepare(statement);
          };
        }
        return Reflect.get(target, property);
      },
    });
    const response = await exported({ settings: { DIRECTORY: failingDirectory } });
    expect(response.status).toBe(UNAVAILABLE_STATUS);
    expectAdminHeaders(response);
    expect(response.headers.get('Content-Disposition')).toBeNull();
    expect(await response.text()).toBe(await (await serveAdminSignInPage({ notice: AdminNotice.Closed, siteKey: null })).text());
  });
});
