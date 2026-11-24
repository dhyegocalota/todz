import { env } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { SIGN_IN_PROVIDER_OF_KIND, SignInMethod, SignInProviderKind, signInKindOf } from '../src/sign-in-provider';
import { CLOCK_NOW } from './task-fixtures';

const SUBJECT_MAX_LENGTH = 64;
const fakeProvider = SIGN_IN_PROVIDER_OF_KIND[SignInProviderKind.Fake];
const emailProvider = SIGN_IN_PROVIDER_OF_KIND[SignInProviderKind.Email];

function verifyingFake({ identityToken, linkVerifier }: { identityToken: string; linkVerifier?: string }): Promise<string | null> {
  return fakeProvider.verify({ identityToken, linkVerifier, directory: env.DIRECTORY, now: CLOCK_NOW });
}

describe('the fake sign-in provider', () => {
  test('asks for an identity', () => {
    expect(fakeProvider.method).toBe(SignInMethod.Identity);
  });

  test.each([['maria'], ['Maria.Silva_01-x'], ['a'], ['a'.repeat(SUBJECT_MAX_LENGTH)]])('%s is its own subject', async (identityToken) => {
    expect(await verifyingFake({ identityToken })).toBe(identityToken);
  });

  test('ignores a link verifier', async () => {
    expect(await verifyingFake({ identityToken: 'maria', linkVerifier: 'whatever' })).toBe('maria');
  });

  test.each([[''], ['a b'], ['a/b'], ['maria\n'], ['\nmaria'], ['maría'], ['a'.repeat(SUBJECT_MAX_LENGTH + 1)], ['a+b'], ['a@b.com']])(
    '%j is refused',
    async (identityToken) => {
      expect(await verifyingFake({ identityToken })).toBeNull();
    },
  );
});

describe('the email sign-in provider', () => {
  test('asks for a link', () => {
    expect(emailProvider.method).toBe(SignInMethod.Link);
  });

  test('refuses a token with no verifier', async () => {
    const identityToken = 'A'.repeat(43);
    expect(await emailProvider.verify({ identityToken, linkVerifier: undefined, directory: env.DIRECTORY, now: CLOCK_NOW })).toBeNull();
  });
});

describe('signInKindOf', () => {
  test('fake names the fake kind', () => {
    expect(signInKindOf('fake')).toBe(SignInProviderKind.Fake);
  });

  test('email names the email kind', () => {
    expect(signInKindOf('email')).toBe(SignInProviderKind.Email);
  });

  test.each([[undefined], [''], ['apple'], ['Fake'], ['Email'], [' fake'], ['toString'], ['__proto__'], ['constructor']])(
    '%j names no kind',
    (configured) => {
      expect(signInKindOf(configured)).toBeNull();
    },
  );
});
