import { digestCredential } from './credential-digest';
import { spendSignInLink } from './directory-sign-in-links';
import { enumValueOf } from './enum-value';

const FAKE_SUBJECT_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

export enum SignInProviderKind {
  Fake = 'fake',
  Email = 'email',
}

export enum SignInMethod {
  Identity = 'identity',
  Link = 'link',
}

export type SignInVerification = {
  identityToken: string;
  linkVerifier: string | undefined;
  directory: D1Database;
  now: number;
};

export type SignInProvider = { method: SignInMethod; verify(verification: SignInVerification): Promise<string | null> };

// NB ADR 0020: the fake believes any well-formed token, so only a development or test binding may select it.
export const SIGN_IN_PROVIDER_OF_KIND: Record<SignInProviderKind, SignInProvider> = {
  [SignInProviderKind.Fake]: {
    method: SignInMethod.Identity,
    async verify({ identityToken }) {
      if (!FAKE_SUBJECT_PATTERN.test(identityToken)) return null;
      return identityToken;
    },
  },
  [SignInProviderKind.Email]: {
    method: SignInMethod.Link,
    async verify({ identityToken, linkVerifier, directory, now }) {
      if (linkVerifier === undefined) return null;
      return spendSignInLink({
        directory,
        digest: await digestCredential(identityToken),
        challenge: await digestCredential(linkVerifier),
        now,
      });
    },
  },
};

export function signInKindOf(configured: string | undefined): SignInProviderKind | null {
  return enumValueOf({ enumeration: SignInProviderKind, candidate: configured });
}
