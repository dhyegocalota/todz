import { ADMIN_RATE_LIMIT_PERIOD_SECONDS } from '@todz/types';
import type { Env } from '../env';
import { HttpHeader } from '../http-header';
import { HttpStatus } from '../http-status';
import { siteKeyOf } from '../turnstile-page';
import { serveAdminSignInPage } from './admin-page';
import { ADMIN_RESPONSE_HEADERS, AdminPath } from './admin-paths';
import { AdminNotice } from './admin-waitlist';

const LOCATION_HEADER = 'Location';

type AdminAnswerParts = { status: HttpStatus; cookies?: string[] };

export const STATUS_OF_NOTICE: Record<AdminNotice, HttpStatus> = {
  [AdminNotice.None]: HttpStatus.Ok,
  [AdminNotice.CheckInbox]: HttpStatus.Ok,
  [AdminNotice.TryAgain]: HttpStatus.TooManyRequests,
  [AdminNotice.Closed]: HttpStatus.Unavailable,
  [AdminNotice.Forbidden]: HttpStatus.Forbidden,
};

function adminAnswerWith({ answer, cookies = [] }: { answer: Response; cookies?: string[] }): Response {
  Object.entries(ADMIN_RESPONSE_HEADERS).forEach(([name, value]) => answer.headers.set(name, value));
  cookies.forEach((cookie) => answer.headers.append(HttpHeader.SetCookie, cookie));
  if (answer.status === HttpStatus.TooManyRequests) answer.headers.set(HttpHeader.RetryAfter, String(ADMIN_RATE_LIMIT_PERIOD_SECONDS));
  return answer;
}

export function adminPageAnswerOf({ page, status, cookies }: AdminAnswerParts & { page: Response }): Response {
  return adminAnswerWith({ answer: new Response(page.body, { status, headers: page.headers }), cookies });
}

export async function adminCardAnswerOf({
  notice,
  siteKey,
  cookies,
}: {
  notice: AdminNotice;
  siteKey: string | null;
  cookies?: string[];
}): Promise<Response> {
  const page = await serveAdminSignInPage({ notice, siteKey });
  return adminPageAnswerOf({ page, status: STATUS_OF_NOTICE[notice], cookies });
}

export function adminClosedAnswerOf({ env, cookies }: { env: Env; cookies?: string[] }): Promise<Response> {
  return adminCardAnswerOf({ notice: AdminNotice.Closed, siteKey: siteKeyOf(env), cookies });
}

export function adminJsonAnswerOf({ status, cookies }: AdminAnswerParts): Response {
  return adminAnswerWith({ answer: Response.json({}, { status }), cookies });
}

export function adminRedirectAnswerOf({ cookies }: { cookies?: string[] } = {}): Response {
  const answer = new Response(null, { status: HttpStatus.SeeOther, headers: { [LOCATION_HEADER]: AdminPath.Panel } });
  return adminAnswerWith({ answer, cookies });
}
