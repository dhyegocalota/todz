import { describe, expect, test } from 'vitest';
import { capturedNames, readRepositoryFile } from './repository-files';

const SWIFT_LANGUAGE_FILE = 'apps/macos/TodzKit/Sources/TodzKit/AppLanguage.swift';
const TYPES_LANGUAGE_FILE = 'libs/types/src/language.ts';
const SWIFT_CASE_PATTERN = /case (\w+) = "([^"]+)"/g;
const SWIFT_NAME_PATTERN = /case \.\w+: "([^"]+)"/g;
const TYPES_MEMBER_PATTERN = /^\s+(\w+) = '([^']+)',?$/gm;
const TYPES_NATIVE_NAME_PATTERN = /nativeName: '([^']+)'/g;

type Member = { name: string; code: string };

function swiftMembers(): Member[] {
  return [...readRepositoryFile(SWIFT_LANGUAGE_FILE).matchAll(SWIFT_CASE_PATTERN)].map((match) => ({ name: match[1]!, code: match[2]! }));
}

function typesMembers(): Member[] {
  return [...readRepositoryFile(TYPES_LANGUAGE_FILE).matchAll(TYPES_MEMBER_PATTERN)].map((match) => ({
    name: match[1]!.charAt(0).toLowerCase() + match[1]!.slice(1),
    code: match[2]!,
  }));
}

describe('the Swift language list', () => {
  test('mirrors the Language enum of libs/types, member by member and in order', () => {
    expect(swiftMembers()).toEqual(typesMembers());
  });

  test('names each language the way libs/types names it in itself', () => {
    const swiftNames = capturedNames({ text: readRepositoryFile(SWIFT_LANGUAGE_FILE), pattern: SWIFT_NAME_PATTERN });
    const typesNames = capturedNames({ text: readRepositoryFile(TYPES_LANGUAGE_FILE), pattern: TYPES_NATIVE_NAME_PATTERN });
    expect(swiftNames).toEqual(typesNames);
  });
});
