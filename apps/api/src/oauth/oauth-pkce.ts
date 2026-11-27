import { base64UrlOf } from '../credential-secret';

const DIGEST_ALGORITHM = 'SHA-256';
const VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/;
export const CODE_CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const CODE_CHALLENGE_METHOD = 'S256';

export function isWellFormedVerifier(verifier: string): boolean {
  return VERIFIER_PATTERN.test(verifier);
}

// NB ADR 0109: only S256 is accepted; the challenge is the unpadded base64url SHA-256 of the verifier (RFC 7636 §4.2).
export async function isVerifierOfChallenge({ verifier, challenge }: { verifier: string; challenge: string }): Promise<boolean> {
  if (!isWellFormedVerifier(verifier)) return false;
  const digest = await crypto.subtle.digest(DIGEST_ALGORITHM, new TextEncoder().encode(verifier));
  return base64UrlOf(new Uint8Array(digest)) === challenge;
}
