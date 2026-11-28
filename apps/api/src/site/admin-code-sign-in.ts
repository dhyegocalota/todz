import { MILLISECONDS_PER_SECOND } from '@todz/types';
import { z } from 'zod';
import { digestCredential } from '../credential-digest';
import { CodeTable, CodeVerdict, EMAIL_CODE_PATTERN, spendEmailCode } from '../email-code';
import { normalizedAddress } from '../email-address';
import { HttpHeader } from '../http-header';
import { MediaType, hasMediaType, isBoundedRequest } from '../request-body';
import { publicOriginOf } from '../sign-in-links';
import { siteKeyOf } from '../turnstile-page';
import { adminCardAnswerOf, adminClosedAnswerOf, adminRedirectAnswerOf } from './admin-answer';
import { adminClientRefusal, adminCodeRefusal, isAdminCodeUnguarded } from './admin-limiter';
import { AdminNotice } from './admin-notice';
import { AdminField, AdminPath } from './admin-paths';
import { AdminCookie, adminCookieValueOf, adminEmailOf, isSameOriginPost } from './admin-session';
import { openedSessionCookies } from './admin-sign-in';
import { EMAIL_CODE_FIELD } from './email-code-input';
import type { SiteContext } from './site-endpoint';

const CodeFormSchema = z.object({ [EMAIL_CODE_FIELD]: z.string(), [AdminField.Email]: z.string().optional() });

type CodeForm = z.output<typeof CodeFormSchema>;

async function codeFormOf(request: Request): Promise<CodeForm | null> {
  const isReadableForm = isBoundedRequest({ request }) && hasMediaType({ request, mediaType: MediaType.Form });
  if (!isReadableForm) return null;
  const parsed = CodeFormSchema.safeParse(Object.fromEntries(new URLSearchParams(await request.text())));
  if (!parsed.success) return null;
  return parsed.data;
}

function addressOf(form: CodeForm | null): string | undefined {
  if (form === null || form[AdminField.Email] === undefined) return undefined;
  const address = normalizedAddress(form[AdminField.Email]);
  if (address === null) return undefined;
  return address;
}

// NB ADR 0127: the code spends the admin link only with the challenge cookie of the browser that asked, and a wrong code answers the same card whether or not the address typed is the admin's.
export async function serveAdminCodeSession({ request, env }: SiteContext): Promise<Response> {
  const adminEmail = adminEmailOf(env);
  const siteKey = siteKeyOf(env);
  const isClosed = adminEmail === null || publicOriginOf(env.SITE_ORIGIN) === null || isAdminCodeUnguarded({ request, env });
  if (isClosed) return adminClosedAnswerOf({ request, env });
  if (!isSameOriginPost({ request, env })) return adminCardAnswerOf({ request, notice: AdminNotice.Forbidden, siteKey });
  const clientRefusal = await adminClientRefusal({ request, env, path: AdminPath.CodeSessions });
  if (clientRefusal !== null) return adminCardAnswerOf({ request, notice: clientRefusal, siteKey });
  const codeRefusal = await adminCodeRefusal({ request, env });
  if (codeRefusal !== null) return adminCardAnswerOf({ request, notice: codeRefusal, siteKey });
  const form = await codeFormOf(request);
  const address = addressOf(form);
  const challenge = adminCookieValueOf({ request, cookie: AdminCookie.Challenge });
  const isPresentedCode = form !== null && challenge !== null && EMAIL_CODE_PATTERN.test(form[EMAIL_CODE_FIELD]);
  if (!isPresentedCode) return adminCardAnswerOf({ request, notice: AdminNotice.WrongCode, siteKey, address });
  const now = Date.now();
  const outcome = await spendEmailCode({
    directory: env.DIRECTORY,
    table: CodeTable.AdminSignInLinks,
    email: adminEmail,
    challenge: await digestCredential(challenge),
    code: form[EMAIL_CODE_FIELD],
    now,
  }).catch(() => null);
  if (outcome === null) return adminClosedAnswerOf({ request, env });
  if (outcome.verdict === CodeVerdict.Locked) {
    const locked = await adminCardAnswerOf({ request, notice: AdminNotice.CodeLocked, siteKey, address });
    locked.headers.set(HttpHeader.RetryAfter, String(Math.ceil(outcome.retryAfterMs / MILLISECONDS_PER_SECOND)));
    return locked;
  }
  if (outcome.verdict === CodeVerdict.Wrong) return adminCardAnswerOf({ request, notice: AdminNotice.WrongCode, siteKey, address });
  const cookies = await openedSessionCookies({ env, adminEmail, now });
  if (cookies === null) return adminClosedAnswerOf({ request, env });
  return adminRedirectAnswerOf({ cookies });
}
