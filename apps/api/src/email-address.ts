const ADDRESS_LENGTH_MAX = 254;
const ADDRESS_CHARACTER = '[^@<>,"\\x00-\\x20\\x7f-\\uffff]';
const ADDRESS_PATTERN = new RegExp(`^${ADDRESS_CHARACTER}+@${ADDRESS_CHARACTER}+\\.${ADDRESS_CHARACTER}+$`);

export function normalizedAddress(email: string): string | null {
  const address = email.trim().toLowerCase();
  const isAddress = address.length <= ADDRESS_LENGTH_MAX && ADDRESS_PATTERN.test(address);
  if (!isAddress) return null;
  return address;
}
