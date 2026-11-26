const DIGEST_ALGORITHM = 'SHA-256';
const HEXADECIMAL_RADIX = 16;
const HEXADECIMAL_BYTE_WIDTH = 2;

const KEYED_DIGEST_ALGORITHM = { name: 'HMAC', hash: DIGEST_ALGORITHM };
const SIGN_USAGE = 'sign';

function hexadecimalOf(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(HEXADECIMAL_RADIX).padStart(HEXADECIMAL_BYTE_WIDTH, '0')).join('');
}

export async function keyedDigest({ secret, text }: { secret: string; text: string }): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), KEYED_DIGEST_ALGORITHM, false, [SIGN_USAGE]);
  return hexadecimalOf(await crypto.subtle.sign(KEYED_DIGEST_ALGORITHM.name, key, encoder.encode(text)));
}

export async function digestCredential(secret: string): Promise<string> {
  const digest = await crypto.subtle.digest(DIGEST_ALGORITHM, new TextEncoder().encode(secret));
  return hexadecimalOf(digest);
}
