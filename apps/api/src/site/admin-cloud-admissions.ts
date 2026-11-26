import { CLOUD_QUEUE_ADMIN_ROWS_MAX } from '@todz/types';
import { CLOUD_COPY } from '../cloud-copy';
import { sendCloudMail } from '../cloud-mail';
import { admitAddress, admitNextAddresses } from '../cloud-queue-store';
import { normalizedAddress } from '../email-address';
import type { Env } from '../env';
import { POSITIVE_WHOLE_NUMBER_PATTERN } from '../fair-use-limits';
import { siteKeyOf } from '../turnstile-page';
import { adminCardAnswerOf, adminRedirectAnswerOf } from './admin-answer';
import { AdminNotice } from './admin-notice';
import { AdminField, AdminPath } from './admin-paths';
import { hasAdminSession, isSameOriginPost } from './admin-session';
import type { SiteContext } from './site-endpoint';

function admittedAddressesOf({ env, form, now }: { env: Env; form: FormData; now: number }): Promise<string[]> {
  const directory = env.DIRECTORY;
  const email = form.get(AdminField.Email);
  const count = form.get(AdminField.Count);
  const address = typeof email === 'string' ? normalizedAddress(email) : null;
  if (address !== null) return admitAddress({ directory, email: address, now });
  const isCount = typeof count === 'string' && POSITIVE_WHOLE_NUMBER_PATTERN.test(count);
  if (!isCount) return Promise.resolve([]);
  return admitNextAddresses({ directory, count: Math.min(Number(count), CLOUD_QUEUE_ADMIN_ROWS_MAX), now });
}

export async function serveAdminCloudAdmissions({ request, env }: SiteContext): Promise<Response> {
  if (!isSameOriginPost({ request, env })) return adminCardAnswerOf({ notice: AdminNotice.Forbidden, siteKey: siteKeyOf(env) });
  const isSignedIn = await hasAdminSession({ request, env, now: Date.now() }).catch(() => false);
  if (!isSignedIn) return adminRedirectAnswerOf();
  const admitted = await admittedAddressesOf({ env, form: await request.formData(), now: Date.now() });
  await Promise.allSettled(
    admitted.map((to) => sendCloudMail({ env, to, subject: CLOUD_COPY.invite.subject, text: CLOUD_COPY.invite.text })),
  );
  return adminRedirectAnswerOf({ location: AdminPath.CloudQueue });
}
