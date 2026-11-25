import { REPLY_ADDRESS_DOMAIN, REPLY_SECRET_LENGTH } from '@todz/types';

const SECRET_PREFIX = 'reply+';
const ESCAPED_DOMAIN = REPLY_ADDRESS_DOMAIN.replaceAll('.', '\\.');
const RECIPIENT_PATTERN = new RegExp(`^reply\\+[0-9a-f]{${REPLY_SECRET_LENGTH}}@${ESCAPED_DOMAIN}$`, 'i');

export function replySecretOf(recipient: string): string | null {
  if (!RECIPIENT_PATTERN.test(recipient)) return null;
  return recipient.slice(SECRET_PREFIX.length, SECRET_PREFIX.length + REPLY_SECRET_LENGTH).toLowerCase();
}
