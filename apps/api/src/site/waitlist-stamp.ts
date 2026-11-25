import { WAITLIST_MINIMUM_FILL_MS } from '@todz/types';

const KEY_INFO = 'todz waitlist render stamp';
const SIGNED_PREFIX = 'waitlist:';
const STAMP_PATTERN = /^\d{13}\.[A-Za-z0-9_-]{43}$/;
const STAMP_SEPARATOR = '.';
const DERIVATION_ALGORITHM = 'HKDF';
const DERIVATION_HASH = 'SHA-256';
const SIGNATURE_ALGORITHM = { name: 'HMAC', hash: DERIVATION_HASH };
const SIGNATURE_BITS = 256;
const BASE64_PADDING = '=';
const BASE64_BLOCK_LENGTH = 4;

export enum StampVerdict {
  Patient = 'patient',
  Missing = 'missing',
  Forged = 'forged',
  TooFast = 'too-fast',
}

const keyOfSecret = new Map<string, Promise<CryptoKey>>();

function derivedKeyOf(secret: string): Promise<CryptoKey> {
  const cached = keyOfSecret.get(secret);
  if (cached !== undefined) return cached;
  const derived = crypto.subtle
    .importKey('raw', new TextEncoder().encode(secret), DERIVATION_ALGORITHM, false, ['deriveKey'])
    .then((material) =>
      crypto.subtle.deriveKey(
        { name: DERIVATION_ALGORITHM, hash: DERIVATION_HASH, salt: new Uint8Array(), info: new TextEncoder().encode(KEY_INFO) },
        material,
        { ...SIGNATURE_ALGORITHM, length: SIGNATURE_BITS },
        false,
        ['sign', 'verify'],
      ),
    );
  keyOfSecret.set(secret, derived);
  return derived;
}

function signedBytesOf(renderedAt: string | number): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(`${SIGNED_PREFIX}${renderedAt}`);
}

function base64UrlOf(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll(BASE64_PADDING, '');
}

function bytesOfBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const base64 = text.replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64.padEnd(Math.ceil(base64.length / BASE64_BLOCK_LENGTH) * BASE64_BLOCK_LENGTH, BASE64_PADDING);
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

export async function renderStampOf({ secret, renderedAt }: { secret: string; renderedAt: number }): Promise<string> {
  const signature = await crypto.subtle.sign(SIGNATURE_ALGORITHM.name, await derivedKeyOf(secret), signedBytesOf(renderedAt));
  return `${renderedAt}${STAMP_SEPARATOR}${base64UrlOf(signature)}`;
}

export async function stampVerdictOf({
  secret,
  stamp,
  now,
}: {
  secret: string;
  stamp: string | undefined;
  now: number;
}): Promise<StampVerdict> {
  if (stamp === undefined || stamp === '') return StampVerdict.Missing;
  if (!STAMP_PATTERN.test(stamp)) return StampVerdict.Forged;
  const separatorIndex = stamp.indexOf(STAMP_SEPARATOR);
  const renderedAtText = stamp.slice(0, separatorIndex);
  const signature = stamp.slice(separatorIndex + STAMP_SEPARATOR.length);
  const isSigned = await crypto.subtle.verify(
    SIGNATURE_ALGORITHM.name,
    await derivedKeyOf(secret),
    bytesOfBase64Url(signature),
    signedBytesOf(renderedAtText),
  );
  const renderedAt = Number(renderedAtText);
  const isFromTheFuture = renderedAt > now;
  if (!isSigned || isFromTheFuture) return StampVerdict.Forged;
  const isTooYoung = now - renderedAt < WAITLIST_MINIMUM_FILL_MS;
  if (isTooYoung) return StampVerdict.TooFast;
  return StampVerdict.Patient;
}
