import { ADMIN_RATE_LIMIT_PERIOD_SECONDS } from '@todz/types';
import type { Env } from '../env';
import { HttpHeader } from '../http-header';
import { HttpStatus } from '../http-status';
import { siteKeyOf } from '../turnstile-page';
import { AdminNotice } from './admin-notice';
import { serveAdminSignInPage } from './admin-page';
import { ADMIN_PAGE_RESPONSE_HEADERS, ADMIN_RESPONSE_HEADERS, AdminPath } from './admin-paths';

type AdminAnswerParts = { status: HttpStatus; cookies?: string[] };

export const STATUS_OF_NOTICE: Record<AdminNotice, HttpStatus> = {
  [AdminNotice.None]: HttpStatus.Ok,
  [AdminNotice.CheckInbox]: HttpStatus.Ok,
  [AdminNotice.TryAgain]: HttpStatus.TooManyRequests,
  [AdminNotice.Closed]: HttpStatus.Unavailable,
  [AdminNotice.Forbidden]: HttpStatus.Forbidden,
  [AdminNotice.WrongCode]: HttpStatus.Unauthorized,
  [AdminNotice.CodeLocked]: HttpStatus.TooManyRequests,
};

function adminAnswerWith({
  answer,
  cookies = [],
  headers = ADMIN_RESPONSE_HEADERS,
}: {
  answer: Response;
  cookies?: string[];
  headers?: Record<string, string>;
}): Response {
  Object.entries(headers).forEach(([name, value]) => answer.headers.set(name, value));
  cookies.forEach((cookie) => answer.headers.append(HttpHeader.SetCookie, cookie));
  if (answer.status === HttpStatus.TooManyRequests) answer.headers.set(HttpHeader.RetryAfter, String(ADMIN_RATE_LIMIT_PERIOD_SECONDS));
  return answer;
}

export function adminPageAnswerOf({ page, status, cookies }: AdminAnswerParts & { page: Response }): Response {
  return adminAnswerWith({
    answer: new Response(page.body, { status, headers: page.headers }),
    cookies,
    headers: ADMIN_PAGE_RESPONSE_HEADERS,
  });
}

export async function adminCardAnswerOf({
  request,
  notice,
  siteKey,
  cookies,
  address,
}: {
  request: Request;
  notice: AdminNotice;
  siteKey: string | null;
  cookies?: string[];
  address?: string;
}): Promise<Response> {
  const page = await serveAdminSignInPage({ request, notice, siteKey, address });
  return adminPageAnswerOf({ page, status: STATUS_OF_NOTICE[notice], cookies });
}

export function adminClosedAnswerOf({ request, env, cookies }: { request: Request; env: Env; cookies?: string[] }): Promise<Response> {
  return adminCardAnswerOf({ request, notice: AdminNotice.Closed, siteKey: siteKeyOf(env), cookies });
}

export function adminJsonAnswerOf({ status, cookies }: AdminAnswerParts): Response {
  return adminAnswerWith({ answer: Response.json({}, { status }), cookies });
}

export function adminRedirectAnswerOf({ cookies, location = AdminPath.Panel }: { cookies?: string[]; location?: string } = {}): Response {
  const answer = new Response(null, { status: HttpStatus.SeeOther, headers: { [HttpHeader.Location]: location } });
  return adminAnswerWith({ answer, cookies });
}
