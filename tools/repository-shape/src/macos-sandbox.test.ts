import { describe, expect, test } from 'vitest';
import { readRepositoryFile } from './repository-files';

const MACOS_PROJECT = 'apps/macos/project.yml';
const APP_ENTITLEMENTS = 'apps/macos/Todz/Todz.entitlements';
const FILE_EXCEPTION_KEY = 'com.apple.security.temporary-exception.files.absolute-path.read-write';
const BUNDLE_SUBTREE = '/Applications/Todz.app/';
const FILE_EXCEPTION_PROJECT_ENTRY = `${FILE_EXCEPTION_KEY}:\n          - ${BUNDLE_SUBTREE}\n`;
const FILE_EXCEPTION_PLIST_ENTRY = `<key>${FILE_EXCEPTION_KEY}</key>\n\t<array>\n\t\t<string>${BUNDLE_SUBTREE}</string>\n\t</array>`;

describe('the app sandbox', () => {
  test('the only file exception is the installed bundle, never the Applications folder', () => {
    expect(readRepositoryFile(MACOS_PROJECT)).toContain(FILE_EXCEPTION_PROJECT_ENTRY);
    expect(readRepositoryFile(APP_ENTITLEMENTS)).toContain(FILE_EXCEPTION_PLIST_ENTRY);
  });
});
