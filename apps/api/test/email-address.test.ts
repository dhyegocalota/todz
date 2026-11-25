import { describe, expect, test } from 'vitest';
import { normalizedAddress } from '../src/email-address';

const ADDRESS_LENGTH_MAX = 254;
const DOMAIN = '@example.com';

describe('the normalized address', () => {
  test.each([
    ['  Maria@Example.COM ', 'maria@example.com'],
    ['maria@example.com', 'maria@example.com'],
    ['maria+todz@mail.example.com', 'maria+todz@mail.example.com'],
  ])('%j normalizes to %j', (email, address) => {
    expect(normalizedAddress(email)).toBe(address);
  });

  test.each([
    ['a host without a dot', 'a@b'],
    ['a space inside', 'a b@c.d'],
    ['a header injection', 'a@b.c\r\nBcc:x@y.z'],
    ['two at signs', 'a@b@c.d'],
    ['angle brackets', '<a@b.c>'],
    ['a comma', 'a@b.c,d@e.f'],
    ['a non-ASCII character', 'mária@example.com'],
    ['nothing', ''],
  ])('%s is no address', (_name, email) => {
    expect(normalizedAddress(email)).toBeNull();
  });

  test('an address of 254 characters is kept and one of 255 is refused', () => {
    const longest = `${'a'.repeat(ADDRESS_LENGTH_MAX - DOMAIN.length)}${DOMAIN}`;
    expect(normalizedAddress(longest)).toBe(longest);
    expect(normalizedAddress(`a${longest}`)).toBeNull();
  });
});
