import { describe, expect, test } from 'vitest';
import { generateCredentialSecret, generateReplySecret, generateStopSecret } from '../src/credential-secret';

const CREDENTIAL_SECRET_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const STOP_SECRET_PATTERN = /^[0-9a-f]{64}$/;
const REPLY_SECRET_PATTERN = /^[0-9a-f]{32}$/;
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

describe('generateStopSecret', () => {
  test('is 64 lowercase hexadecimal characters', () => {
    expect(generateStopSecret()).toMatch(STOP_SECRET_PATTERN);
  });

  test('a hundred secrets are a hundred distinct values', () => {
    const secrets = Array.from({ length: SECRET_SAMPLE_SIZE }, () => generateStopSecret());
    expect(new Set(secrets).size).toBe(SECRET_SAMPLE_SIZE);
  });
});

describe('generateReplySecret', () => {
  test('is 32 lowercase hexadecimal characters', () => {
    expect(generateReplySecret()).toMatch(REPLY_SECRET_PATTERN);
  });

  test('a hundred secrets are a hundred distinct values', () => {
    const secrets = Array.from({ length: SECRET_SAMPLE_SIZE }, () => generateReplySecret());
    expect(new Set(secrets).size).toBe(SECRET_SAMPLE_SIZE);
  });
});
