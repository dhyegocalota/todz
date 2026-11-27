import { CLOUD_QUEUE_LINK_LIFETIME_DAYS, MILLISECONDS_PER_DAY } from '@todz/types';
import { isSameSignature, keyedDigest } from './credential-digest';
import { normalizedAddress } from './email-address';
import type { Env } from './env';

const PART_SEPARATOR = '.';
const PART_COUNT = 3;
const HEXADECIMAL_RADIX = 16;
const HEXADECIMAL_BYTE_WIDTH = 2;
const HEXADECIMAL_PAIR_PATTERN = /^(?:[0-9a-f]{2})+$/;
const EXPIRY_PATTERN = /^\d{1,15}$/;
const PURPOSE = 'cloud-queue';

function hexadecimalOfText(text: string): string {
  return [...new TextEncoder().encode(text)].map((byte) => byte.toString(HEXADECIMAL_RADIX).padStart(HEXADECIMAL_BYTE_WIDTH, '0')).join('');
}

function textOfHexadecimal(hexadecimal: string): string | null {
  if (!HEXADECIMAL_PAIR_PATTERN.test(hexadecimal)) return null;
  const pairs = hexadecimal.match(/../g);
  if (pairs === null) return null;
  const bytes = Uint8Array.from(pairs.map((pair) => parseInt(pair, HEXADECIMAL_RADIX)));
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function signedTextOf({ address, expiresAt }: { address: string; expiresAt: number }): string {
  return `${PURPOSE}:${address}:${expiresAt}`;
}

export function queueSecretOf(env: Env): string | null {
  const { SIGN_UP_KEY_SECRET: secret } = env;
  if (secret === undefined || secret === '') return null;
  return secret;
}

// NB ADR 0099: the queue link proves its holder reached the address, so a typed address never joins the line.
export async function cloudQueueTokenOf({ secret, address, now }: { secret: string; address: string; now: number }): Promise<string> {
  const expiresAt = now + CLOUD_QUEUE_LINK_LIFETIME_DAYS * MILLISECONDS_PER_DAY;
  const signature = await keyedDigest({ secret, text: signedTextOf({ address, expiresAt }) });
  return [hexadecimalOfText(address), expiresAt, signature].join(PART_SEPARATOR);
}

export async function cloudQueueAddressOf({ secret, token, now }: { secret: string; token: string; now: number }): Promise<string | null> {
  const parts = token.split(PART_SEPARATOR);
  if (parts.length !== PART_COUNT) return null;
  const [addressPart, expiryPart, signature] = parts;
  if (addressPart === undefined || expiryPart === undefined || signature === undefined) return null;
  if (!EXPIRY_PATTERN.test(expiryPart)) return null;
  const expiresAt = Number(expiryPart);
  if (expiresAt <= now) return null;
  const address = textOfHexadecimal(addressPart);
  if (address === null || normalizedAddress(address) !== address) return null;
  const expected = await keyedDigest({ secret, text: signedTextOf({ address, expiresAt }) });
  if (!(await isSameSignature({ secret, left: expected, right: signature }))) return null;
  return address;
}
