const DIGEST_ALGORITHM = 'SHA-256';
const HEXADECIMAL_RADIX = 16;
const HEXADECIMAL_BYTE_WIDTH = 2;

export async function digestCredential(secret: string): Promise<string> {
  const digest = await crypto.subtle.digest(DIGEST_ALGORITHM, new TextEncoder().encode(secret));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(HEXADECIMAL_RADIX).padStart(HEXADECIMAL_BYTE_WIDTH, '0')).join('');
}
