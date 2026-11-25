import { ADMIN_RATE_LIMIT_PERIOD_SECONDS } from '@todz/types';
import { HttpHeader } from '../http-header';
import { HttpStatus } from '../http-status';
import { ADMIN_RESPONSE_HEADERS, AdminPath } from './admin-paths';

const LOCATION_HEADER = 'Location';

type AdminAnswerParts = { status: HttpStatus; cookies?: string[] };

function adminAnswerWith({ answer, cookies = [] }: { answer: Response; cookies?: string[] }): Response {
  Object.entries(ADMIN_RESPONSE_HEADERS).forEach(([name, value]) => answer.headers.set(name, value));
  cookies.forEach((cookie) => answer.headers.append(HttpHeader.SetCookie, cookie));
  if (answer.status === HttpStatus.TooManyRequests) answer.headers.set(HttpHeader.RetryAfter, String(ADMIN_RATE_LIMIT_PERIOD_SECONDS));
  return answer;
}

export function adminPageAnswerOf({ page, status, cookies }: AdminAnswerParts & { page: Response }): Response {
  return adminAnswerWith({ answer: new Response(page.body, { status, headers: page.headers }), cookies });
}

export function adminJsonAnswerOf({ status, cookies }: AdminAnswerParts): Response {
  return adminAnswerWith({ answer: Response.json({}, { status }), cookies });
}

export function adminRedirectAnswerOf({ cookies }: { cookies?: string[] } = {}): Response {
  const answer = new Response(null, { status: HttpStatus.SeeOther, headers: { [LOCATION_HEADER]: AdminPath.Panel } });
  return adminAnswerWith({ answer, cookies });
}
