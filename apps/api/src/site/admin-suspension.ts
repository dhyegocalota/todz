import { setOwnerSuspension } from '../owner-usage-store';
import { siteKeyOf } from '../turnstile-page';
import { adminCardAnswerOf, adminRedirectAnswerOf } from './admin-answer';
import { AdminNotice } from './admin-notice';
import { AdminField, AdminPath } from './admin-paths';
import { hasAdminSession, isSameOriginPost } from './admin-session';
import type { SiteContext } from './site-endpoint';

export enum SuspensionChoice {
  Suspend = 'suspend',
  Restore = 'restore',
}

function isSuspensionChoice(value: FormDataEntryValue | null): value is SuspensionChoice {
  return Object.values(SuspensionChoice).some((choice) => choice === value);
}

export async function serveAdminSuspension({ request, env }: SiteContext): Promise<Response> {
  if (!isSameOriginPost({ request, env })) return adminCardAnswerOf({ request, notice: AdminNotice.Forbidden, siteKey: siteKeyOf(env) });
  const isSignedIn = await hasAdminSession({ request, env, now: Date.now() }).catch(() => false);
  if (!isSignedIn) return adminRedirectAnswerOf();
  const form = await request.formData();
  const ownerId = form.get(AdminField.Owner);
  const choice = form.get(AdminField.Choice);
  if (typeof ownerId !== 'string' || !isSuspensionChoice(choice)) return adminRedirectAnswerOf({ location: AdminPath.Usage });
  const suspendedAt = choice === SuspensionChoice.Suspend ? Date.now() : null;
  await setOwnerSuspension({ directory: env.DIRECTORY, ownerId, suspendedAt });
  return adminRedirectAnswerOf({ location: AdminPath.Usage });
}
