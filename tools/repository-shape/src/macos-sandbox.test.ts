import { describe, expect, test } from 'vitest';
import { readRepositoryFile } from './repository-files';

const MACOS_PROJECT = 'apps/macos/project.yml';
const APP_ENTITLEMENTS = 'apps/macos/Todz/Todz.entitlements';
const FILE_EXCEPTION_KEY = 'com.apple.security.temporary-exception.files.absolute-path.read-write';
const SUBTREES = ['/Applications/Todz.app/', '/Applications/.Todz.app.moving/'];
const FILE_EXCEPTION_PROJECT_ENTRY = `${FILE_EXCEPTION_KEY}:\n${SUBTREES.map((subtree) => `          - ${subtree}\n`).join('')}`;
const FILE_EXCEPTION_PLIST_ENTRY = `<key>${FILE_EXCEPTION_KEY}</key>\n\t<array>\n${SUBTREES.map((subtree) => `\t\t<string>${subtree}</string>\n`).join('')}\t</array>`;

describe('the app sandbox', () => {
  test('the only file exceptions are the installed bundle and its staging bundle, never the Applications folder', () => {
    expect(readRepositoryFile(MACOS_PROJECT)).toContain(FILE_EXCEPTION_PROJECT_ENTRY);
    expect(readRepositoryFile(APP_ENTITLEMENTS)).toContain(FILE_EXCEPTION_PLIST_ENTRY);
  });
});
