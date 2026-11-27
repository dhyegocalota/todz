import { describe, expect, test } from 'vitest';
import { readRepositoryFile, repositoryFiles } from './repository-files';
import { swiftCopyValue } from './swift-copy';

const MACOS_SWIFT_PATHSPEC = 'apps/macos/*.swift';
const SETTINGS_COPY = 'apps/macos/Copy/SettingsCopy.swift';
const WORKSPACE_LOCK_COPY = 'apps/macos/Copy/WorkspaceLockCopy.swift';
const LOCK_REVEALING_WORDS = ['Locked workspace', 'lockedState', 'unlockRefusal'];
const NEUTRAL_SETTINGS_COPY: Record<string, string> = {
  lockWorkspaces: 'Require Touch ID to switch workspaces',
  lockWorkspacesDetail: 'Ask for Touch ID or your Mac password before switching workspaces.',
  lockTimeout: 'Ask again after',
  lockTimeoutDetail: 'Also asks again when the Mac sleeps or the screen locks.',
  lockUnavailable: 'Set a password for this Mac to turn this on.',
};
const NEUTRAL_REASON_COPY: Record<string, string> = {
  reasonSwitch: 'switch workspaces',
  reasonTurnOff: 'change this setting',
  reasonTimeout: 'change this setting',
};

describe('a locked session reveals nothing', () => {
  test.each(LOCK_REVEALING_WORDS)('%s appears nowhere in the macOS app', (word) => {
    const filesWithTheWord = repositoryFiles(MACOS_SWIFT_PATHSPEC).filter((path) => readRepositoryFile(path).includes(word));
    expect(filesWithTheWord).toEqual([]);
  });

  test.each(Object.entries(NEUTRAL_SETTINGS_COPY))('the Settings copy %s is neutral', (name, value) => {
    expect(swiftCopyValue({ text: readRepositoryFile(SETTINGS_COPY), name })).toBe(value);
  });

  test.each(Object.entries(NEUTRAL_REASON_COPY))('the Touch ID reason %s names nothing hidden', (name, value) => {
    expect(swiftCopyValue({ text: readRepositoryFile(WORKSPACE_LOCK_COPY), name })).toBe(value);
  });
});
