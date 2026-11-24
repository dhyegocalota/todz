import { describe, expect, test } from 'vitest';
import { digestCredential } from '../src/credential-digest';

const ABC_DIGEST = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
const LINK_VERIFIER_VECTOR = 'A'.repeat(43);
const LINK_CHALLENGE_VECTOR = '0f007385b6f9d4b7eeb2748605afe1a984a0a3bfa3f014d09e2a784ce9e5cd1a';
const EMPTY_DIGEST = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

describe('digestCredential', () => {
  test('digests a secret to its lowercase hexadecimal SHA-256', async () => {
    expect(await digestCredential('abc')).toBe(ABC_DIGEST);
  });

  test('digests an empty secret to the SHA-256 of nothing', async () => {
    expect(await digestCredential('')).toBe(EMPTY_DIGEST);
  });

  test('pin: the link verifier of 43 A characters has the challenge both lanes share', async () => {
    expect(await digestCredential(LINK_VERIFIER_VECTOR)).toBe(LINK_CHALLENGE_VECTOR);
  });
});
