import { emailSenderForOrigin, REPLY_TO_ADDRESS } from './email-sender';
import { escapedHtml } from './escaped-html';
import type { Env } from './env';
import { publicOriginOf } from './sign-in-links';

export async function sendCloudMail({ env, to, subject, text }: { env: Env; to: string; subject: string; text: string }): Promise<void> {
  const sender = emailSenderForOrigin({ env, origin: publicOriginOf(env.PUBLIC_ORIGIN) });
  if (sender === null) throw new Error('the cloud mail has no public origin or email sender');
  await sender.send({ to, subject, text, html: `<p>${escapedHtml(text)}</p>`, replyTo: REPLY_TO_ADDRESS });
}
