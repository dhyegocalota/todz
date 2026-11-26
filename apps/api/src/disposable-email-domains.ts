const DISPOSABLE_EMAIL_DOMAIN_LIST = [
  '10minutemail.com',
  '20minutemail.com',
  'dispostable.com',
  'discard.email',
  'emailondeck.com',
  'fakeinbox.com',
  'fakemail.net',
  'getairmail.com',
  'getnada.com',
  'guerrillamail.com',
  'guerrillamailblock.com',
  'harakirimail.com',
  'inboxkitten.com',
  'maildrop.cc',
  'mailinator.com',
  'mailnesia.com',
  'mintemail.com',
  'mohmal.com',
  'moakt.com',
  'sharklasers.com',
  'spamgourmet.com',
  'tempail.com',
  'tempinbox.com',
  'tempmail.com',
  'temp-mail.org',
  'throwaway.email',
  'trashmail.com',
  'yopmail.com',
];

const DISPOSABLE_EMAIL_DOMAINS = new Set(DISPOSABLE_EMAIL_DOMAIN_LIST);

export function isDisposableEmailAddress(address: string): boolean {
  const domain = address.slice(address.lastIndexOf('@') + 1).toLowerCase();
  return DISPOSABLE_EMAIL_DOMAINS.has(domain);
}
