import { HttpHeader } from '../http-header';
import { adminClosedAnswerOf, adminRedirectAnswerOf } from './admin-answer';
import { ADMIN_RESPONSE_HEADERS } from './admin-paths';
import { hasAdminSession } from './admin-session';
import { waitlistRowsOf } from './admin-store';
import type { WaitlistRow } from './admin-waitlist';
import type { SiteContext } from './site-endpoint';

const CSV_CONTENT_TYPE = 'text/csv; charset=utf-8';
const CSV_DISPOSITION = 'attachment; filename="todz-waitlist.csv"';
const CSV_HEADER_FIELDS = ['address', 'joined_at', 'confirmation'];
const CSV_FIELD_SEPARATOR = ',';
const CSV_LINE_BREAK = '\r\n';
const CSV_QUOTE = '"';
const FORMULA_START_PATTERN = /^[=+\-@\t\r]/;
const FORMULA_GUARD = "'";

function csvFieldOf(value: string): string {
  const isFormulaStart = FORMULA_START_PATTERN.test(value);
  const guarded = isFormulaStart ? `${FORMULA_GUARD}${value}` : value;
  return `${CSV_QUOTE}${guarded.replaceAll(CSV_QUOTE, `${CSV_QUOTE}${CSV_QUOTE}`)}${CSV_QUOTE}`;
}

function csvLineOf(fields: string[]): string {
  return `${fields.map(csvFieldOf).join(CSV_FIELD_SEPARATOR)}${CSV_LINE_BREAK}`;
}

// NB ADR 0051: every field is quoted and a field that starts like a formula is prefixed, so a spreadsheet never runs an address.
export function waitlistCsvOf(rows: WaitlistRow[]): string {
  const lines = rows.map(({ address, joinedAt, confirmation }) => [address, new Date(joinedAt).toISOString(), confirmation]);
  return [CSV_HEADER_FIELDS, ...lines].map(csvLineOf).join('');
}

export async function serveAdminExport({ request, env }: SiteContext): Promise<Response> {
  const isSignedIn = await hasAdminSession({ request, env, now: Date.now() }).catch(() => null);
  if (isSignedIn === null) return adminClosedAnswerOf({ env });
  if (!isSignedIn) return adminRedirectAnswerOf();
  const rows = await waitlistRowsOf({ database: env.DIRECTORY }).catch(() => null);
  if (rows === null) return adminClosedAnswerOf({ env });
  return new Response(waitlistCsvOf(rows), {
    headers: { ...ADMIN_RESPONSE_HEADERS, [HttpHeader.ContentType]: CSV_CONTENT_TYPE, [HttpHeader.ContentDisposition]: CSV_DISPOSITION },
  });
}
