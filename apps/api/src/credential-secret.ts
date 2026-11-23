const SECRET_BYTE_LENGTH = 32;
const BASE64_PADDING_PATTERN = /=+$/;

export function generateCredentialSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(SECRET_BYTE_LENGTH));
  return btoa(String.fromCharCode(...bytes))
    .replace(BASE64_PADDING_PATTERN, '')
    .replaceAll('+', '-')
    .replaceAll('/', '_');
}
