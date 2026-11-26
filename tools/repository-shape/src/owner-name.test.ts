import { describe, expect, test } from 'vitest';
import { committableFiles, readRepositoryFile } from './repository-files';

const OWNER_FIRST_NAME = ['Dhy', 'ego'].join('');
const OWNER_FULL_NAME = `${OWNER_FIRST_NAME} Calota`;
const BARE_FIRST_NAME_PATTERN = new RegExp(`${OWNER_FIRST_NAME}(?! Calota)`);
const BINARY_BYTE = '\u0000';

function namesOwnerByFirstNameAlone(text: string): boolean {
  return BARE_FIRST_NAME_PATTERN.test(text);
}

function filesNamingOwnerByFirstNameAlone(): string[] {
  return committableFiles().filter((path) => {
    const text = readRepositoryFile(path);
    return !text.includes(BINARY_BYTE) && namesOwnerByFirstNameAlone(text);
  });
}

describe('the owner is named in full', () => {
  test('a first name alone is refused', () => {
    expect(namesOwnerByFirstNameAlone(`Built by ${OWNER_FIRST_NAME}.`)).toBe(true);
  });

  test('the full name passes', () => {
    expect(namesOwnerByFirstNameAlone(`Built by ${OWNER_FULL_NAME}.`)).toBe(false);
  });

  test('no tracked text file names the owner by first name alone', () => {
    expect(filesNamingOwnerByFirstNameAlone()).toEqual([]);
  });
});
