import { CLOUD_QUEUE_ADMIN_ROWS_MAX } from '@todz/types';
import { admissionRoomOf } from '../cloud-admission';
import { CLOUD_COPY } from '../cloud-copy';
import { sendCloudMail } from '../cloud-mail';
import { admitAddress, admitNextAddresses } from '../cloud-queue-store';
import { normalizedAddress } from '../email-address';
import type { Env } from '../env';
import { POSITIVE_WHOLE_NUMBER_PATTERN } from '../fair-use-limits';
import { siteKeyOf } from '../turnstile-page';
import { adminCardAnswerOf, adminRedirectAnswerOf } from './admin-answer';
import { AdminNotice } from './admin-notice';
import { ADMIN_NOTICE_PARAMETER, AdminField, AdminPath, CloudQueueAdminNotice } from './admin-paths';
import { hasAdminSession, isSameOriginPost } from './admin-session';
import type { SiteContext } from './site-endpoint';

type Admissions = { admitted: string[]; hasNoRoom: boolean };

async function admittedNextOf({ env, count, room, now }: { env: Env; count: number; room: number | null; now: number }): Promise<string[]> {
  const requested = Math.min(count, CLOUD_QUEUE_ADMIN_ROWS_MAX);
  const admitted = room === null ? requested : Math.min(requested, room);
  return admitNextAddresses({ directory: env.DIRECTORY, count: admitted, now });
}

async function admissionsOf({ env, form, now }: { env: Env; form: FormData; now: number }): Promise<Admissions> {
  const email = form.get(AdminField.Email);
  const count = form.get(AdminField.Count);
  const address = typeof email === 'string' ? normalizedAddress(email) : null;
  const isCount = typeof count === 'string' && POSITIVE_WHOLE_NUMBER_PATTERN.test(count);
  if (address === null && !isCount) return { admitted: [], hasNoRoom: false };
  const room = await admissionRoomOf({ env, now });
  if (room === 0) return { admitted: [], hasNoRoom: true };
  if (address !== null) return { admitted: await admitAddress({ directory: env.DIRECTORY, email: address, now }), hasNoRoom: false };
  return { admitted: await admittedNextOf({ env, count: Number(count), room, now }), hasNoRoom: false };
}

export async function serveAdminCloudAdmissions({ request, env }: SiteContext): Promise<Response> {
  if (!isSameOriginPost({ request, env })) return adminCardAnswerOf({ notice: AdminNotice.Forbidden, siteKey: siteKeyOf(env) });
  const isSignedIn = await hasAdminSession({ request, env, now: Date.now() }).catch(() => false);
  if (!isSignedIn) return adminRedirectAnswerOf();
  const { admitted, hasNoRoom } = await admissionsOf({ env, form: await request.formData(), now: Date.now() });
  await Promise.allSettled(
    admitted.map((to) => sendCloudMail({ env, to, subject: CLOUD_COPY.invite.subject, text: CLOUD_COPY.invite.text })),
  );
  const location = hasNoRoom ? `${AdminPath.CloudQueue}?${ADMIN_NOTICE_PARAMETER}=${CloudQueueAdminNotice.NoRoom}` : AdminPath.CloudQueue;
  return adminRedirectAnswerOf({ location });
}
