import { resetOwnerStoredBytes } from '../owner-usage-store';
import { siteKeyOf } from '../turnstile-page';
import { adminCardAnswerOf, adminRedirectAnswerOf } from './admin-answer';
import { AdminNotice } from './admin-notice';
import { AdminField, AdminPath } from './admin-paths';
import { hasAdminSession, isSameOriginPost } from './admin-session';
import type { SiteContext } from './site-endpoint';

export async function serveAdminStoredTextReset({ request, env }: SiteContext): Promise<Response> {
  if (!isSameOriginPost({ request, env })) return adminCardAnswerOf({ notice: AdminNotice.Forbidden, siteKey: siteKeyOf(env) });
  const isSignedIn = await hasAdminSession({ request, env, now: Date.now() }).catch(() => false);
  if (!isSignedIn) return adminRedirectAnswerOf();
  const ownerId = (await request.formData()).get(AdminField.Owner);
  if (typeof ownerId !== 'string') return adminRedirectAnswerOf({ location: AdminPath.Usage });
  await resetOwnerStoredBytes({ directory: env.DIRECTORY, ownerId });
  return adminRedirectAnswerOf({ location: AdminPath.Usage });
}
