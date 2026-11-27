import { describe, expect, test } from 'vitest';
import { REPOSITORY } from '../../../libs/types/src/constants';
import { readRepositoryFile } from './repository-files';
import { swiftCopyValue } from './swift-copy';

const README_FILE = 'README.md';
const REPOSITORY_ADDRESS_FILE = 'apps/macos/TodzKit/Sources/TodzKit/RepositoryAddress.swift';
const OPEN_SOURCE_COPY_FILE = 'apps/macos/Copy/OpenSourceCopy.swift';
const STAR_BUTTON_FILE = 'apps/macos/Todz/OpenSource/StarRepositoryButton.swift';
const OPEN_SOURCE_LINK_FILE = 'apps/macos/Todz/OpenSource/OpenSourceLink.swift';
const MENU_BAR_MORE_MENU_FILE = 'apps/macos/Todz/MenuBar/MenuBarMoreMenu.swift';
const APP_COMMANDS_FILE = 'apps/macos/Todz/AppCommands.swift';
const SETTINGS_FILE = 'apps/macos/Todz/Settings/SettingsView.swift';
const LICENSE_BADGE = '[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue)](LICENSE)';
const STARS_BADGE = `[![GitHub stars](https://img.shields.io/github/stars/${REPOSITORY.path}?style=flat&cacheSeconds=3600)](${REPOSITORY.url})`;
const OPEN_WORKSPACE_CALL = 'NSWorkspace.shared.open(RepositoryAddress.url)';

describe('the open source surfaces', () => {
  test('the README carries a GitHub stars badge right after the license badge', () => {
    const lines = readRepositoryFile(README_FILE).split('\n');
    expect(lines).toContain(STARS_BADGE);
    expect(lines.indexOf(STARS_BADGE)).toBe(lines.indexOf(LICENSE_BADGE) + 1);
  });

  test('the repository address in TodzKit is the one in libs/types (pin)', () => {
    expect(swiftCopyValue({ text: readRepositoryFile(REPOSITORY_ADDRESS_FILE), name: 'text' })).toBe(REPOSITORY.url);
  });

  test('the app copy says Star todz on GitHub and Open source on GitHub', () => {
    const copy = readRepositoryFile(OPEN_SOURCE_COPY_FILE);
    expect(swiftCopyValue({ text: copy, name: 'starOnGitHub' })).toBe('Star todz on GitHub');
    expect(swiftCopyValue({ text: copy, name: 'openSource' })).toBe('Open source on GitHub');
  });

  test.each([STAR_BUTTON_FILE, OPEN_SOURCE_LINK_FILE])('%s opens the repository address with NSWorkspace', (file) => {
    expect(readRepositoryFile(file)).toContain(OPEN_WORKSPACE_CALL);
  });

  test('the popover More menu, the todz menu and Settings each offer one of them', () => {
    expect(readRepositoryFile(MENU_BAR_MORE_MENU_FILE)).toContain('StarRepositoryButton()');
    expect(readRepositoryFile(APP_COMMANDS_FILE)).toContain('StarRepositoryButton()');
    expect(readRepositoryFile(SETTINGS_FILE)).toContain('OpenSourceLink()');
  });
});
