const FAKE_SUBJECT_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

export enum SignInProviderKind {
  Fake = 'fake',
}

export type SignInProvider = { verify(identityToken: string): Promise<string | null> };

// NB ADR 0020: the fake believes any well-formed token, so only a development or test binding may select it.
export const SIGN_IN_PROVIDER_OF_KIND: Record<SignInProviderKind, SignInProvider> = {
  [SignInProviderKind.Fake]: {
    async verify(identityToken) {
      if (!FAKE_SUBJECT_PATTERN.test(identityToken)) return null;
      return identityToken;
    },
  },
};

export function signInProviderOf(configured: string | undefined): SignInProvider | null {
  const kind = Object.values(SignInProviderKind).find((candidate) => candidate === configured);
  if (kind === undefined) return null;
  return SIGN_IN_PROVIDER_OF_KIND[kind];
}
