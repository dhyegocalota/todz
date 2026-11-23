import { describe, expect, test } from 'vitest';
import { generateCredentialSecret } from '../src/credential-secret';

const CREDENTIAL_SECRET_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const SECRET_SAMPLE_SIZE = 100;

describe('generateCredentialSecret', () => {
  test('is 43 base64url characters without padding', () => {
    expect(generateCredentialSecret()).toMatch(CREDENTIAL_SECRET_PATTERN);
  });

  test('a hundred secrets are a hundred distinct values', () => {
    const secrets = Array.from({ length: SECRET_SAMPLE_SIZE }, () => generateCredentialSecret());
    expect(new Set(secrets).size).toBe(SECRET_SAMPLE_SIZE);
  });
});
