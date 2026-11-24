export enum SignInProviderKind {
  Fake = 'fake',
}

export type SignInProvider = { verify(identityToken: string): Promise<string | null> };

export const SIGN_IN_PROVIDER_OF_KIND: Record<SignInProviderKind, SignInProvider> = {
  [SignInProviderKind.Fake]: {
    async verify() {
      throw new Error('the fake sign-in provider is not implemented');
    },
  },
};

export function signInProviderOf(_configured: string | undefined): SignInProvider | null {
  throw new Error('signInProviderOf is not implemented');
}
