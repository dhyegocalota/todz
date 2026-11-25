const SECRET_BYTE_LENGTH = 32;
const REPLY_SECRET_BYTE_LENGTH = 16;
const HEXADECIMAL_RADIX = 16;
const HEXADECIMAL_BYTE_WIDTH = 2;
const BASE64_PADDING_PATTERN = /=+$/;

export function generateCredentialSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(SECRET_BYTE_LENGTH));
  return btoa(String.fromCharCode(...bytes))
    .replace(BASE64_PADDING_PATTERN, '')
    .replaceAll('+', '-')
    .replaceAll('/', '_');
}

function generateHexadecimalSecret(byteLength: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return [...bytes].map((byte) => byte.toString(HEXADECIMAL_RADIX).padStart(HEXADECIMAL_BYTE_WIDTH, '0')).join('');
}

export function generateReplySecret(): string {
  return generateHexadecimalSecret(REPLY_SECRET_BYTE_LENGTH);
}

export function generateStopSecret(): string {
  return generateHexadecimalSecret(SECRET_BYTE_LENGTH);
}
