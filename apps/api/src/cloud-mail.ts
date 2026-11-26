import { CLOUD_COPY } from './cloud-copy';
import { cloudQueueTokenOf, queueSecretOf } from './cloud-queue-token';
import { emailSenderForOrigin, REPLY_TO_ADDRESS } from './email-sender';
import { escapedHtml } from './escaped-html';
import type { Env } from './env';
import { publicOriginOf } from './sign-in-links';
import { CLOUD_QUEUE_PATH, CLOUD_QUEUE_TOKEN_FIELD } from './site/site-urls';

export async function sendCloudMail({ env, to, subject, text }: { env: Env; to: string; subject: string; text: string }): Promise<void> {
  const sender = emailSenderForOrigin({ env, origin: publicOriginOf(env.PUBLIC_ORIGIN) });
  if (sender === null) throw new Error('the cloud mail has no public origin or email sender');
  await sender.send({ to, subject, text, html: `<p>${escapedHtml(text)}</p>`, replyTo: REPLY_TO_ADDRESS });
}

export async function sendCloudFullMail({ env, to, now }: { env: Env; to: string; now: number }): Promise<void> {
  const siteOrigin = publicOriginOf(env.SITE_ORIGIN);
  if (siteOrigin === null) throw new Error('the cloud full mail needs the site origin');
  const secret = queueSecretOf(env);
  if (secret === null) throw new Error('the cloud full mail needs the sign-up key secret');
  const token = await cloudQueueTokenOf({ secret, address: to, now });
  const text = CLOUD_COPY.fullMail.textOf({ queueUrl: `${siteOrigin}${CLOUD_QUEUE_PATH}?${CLOUD_QUEUE_TOKEN_FIELD}=${token}` });
  await sendCloudMail({ env, to, subject: CLOUD_COPY.fullMail.subject, text });
}
