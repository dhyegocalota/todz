import { describe, expect, test } from 'vitest';
import { readRepositoryFile, repositoryFiles } from './repository-files';

const APP_SOURCE = 'apps/macos/Todz/TodzApp.swift';
const APP_SWIFT_PATHSPEC = 'apps/macos/*.swift';
const MENU_BAR_EXTRA = 'MenuBarExtra {';
const IDENTITY_CHANGES = ['autosaveName', 'NSStatusBar.system.statusItem', 'MenuBarExtra(isInserted'];

function occurrences({ text, fragment }: { text: string; fragment: string }): number {
  return text.split(fragment).length - 1;
}

describe('the menu bar item identity', () => {
  test('the app has one menu bar extra, so macOS knows its item as dev.todz.Todz Item-0 in every release', () => {
    expect(occurrences({ text: readRepositoryFile(APP_SOURCE), fragment: MENU_BAR_EXTRA })).toBe(1);
  });

  test('no Swift source names, adds or hides a status item of its own', () => {
    const offenders = repositoryFiles(APP_SWIFT_PATHSPEC).flatMap((path) => {
      const text = readRepositoryFile(path);
      return IDENTITY_CHANGES.filter((fragment) => text.includes(fragment)).map((fragment) => `${path}: ${fragment}`);
    });
    expect(offenders).toEqual([]);
  });
});
