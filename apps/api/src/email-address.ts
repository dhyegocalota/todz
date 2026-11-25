import { REPLY_ADDRESS_DOMAIN } from '@todz/types';

const ADDRESS_LENGTH_MAX = 254;
const OWN_DOMAIN_SUFFIX = `@${REPLY_ADDRESS_DOMAIN}`;
const ADDRESS_CHARACTER = '[^@<>,"\\x00-\\x20\\x7f-\\uffff:/]';
const DOMAIN_LABEL = '[a-z0-9-]+';
const ADDRESS_PATTERN = new RegExp(`^${ADDRESS_CHARACTER}+@${DOMAIN_LABEL}(\\.${DOMAIN_LABEL})+$`);

export function normalizedAddress(email: string): string | null {
  const address = email.trim().toLowerCase();
  const isAddress = address.length <= ADDRESS_LENGTH_MAX && ADDRESS_PATTERN.test(address);
  if (!isAddress) return null;
  return address;
}

export function isOwnDomainAddress(address: string): boolean {
  return address.endsWith(OWN_DOMAIN_SUFFIX);
}
