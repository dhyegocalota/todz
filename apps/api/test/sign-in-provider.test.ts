import { describe, expect, test } from 'vitest';
import { SIGN_IN_PROVIDER_OF_KIND, SignInProviderKind, signInKindOf } from '../src/sign-in-provider';

const SUBJECT_MAX_LENGTH = 64;
const fakeProvider = SIGN_IN_PROVIDER_OF_KIND[SignInProviderKind.Fake];

describe('the fake sign-in provider', () => {
  test.each([['maria'], ['Maria.Silva_01-x'], ['a'], ['a'.repeat(SUBJECT_MAX_LENGTH)]])('%s is its own subject', async (identityToken) => {
    expect(await fakeProvider.verify(identityToken)).toBe(identityToken);
  });

  test.each([[''], ['a b'], ['a/b'], ['maria\n'], ['\nmaria'], ['maría'], ['a'.repeat(SUBJECT_MAX_LENGTH + 1)], ['a+b'], ['a@b.com']])(
    '%j is refused',
    async (identityToken) => {
      expect(await fakeProvider.verify(identityToken)).toBeNull();
    },
  );
});

describe('signInKindOf', () => {
  test('fake names the fake kind', () => {
    expect(signInKindOf('fake')).toBe(SignInProviderKind.Fake);
  });

  test.each([[undefined], [''], ['apple'], ['Fake'], [' fake'], ['toString'], ['__proto__'], ['constructor']])(
    '%j names no kind',
    (configured) => {
      expect(signInKindOf(configured)).toBeNull();
    },
  );
});
