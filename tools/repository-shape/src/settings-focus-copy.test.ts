import { describe, expect, test } from 'vitest';
import { capturedNames, readRepositoryFile } from './repository-files';
import { swiftCopyValue } from './swift-copy';

const SETTINGS_COPY = 'apps/macos/Copy/SettingsCopy.swift';
const FOCUS_WORD = 'Focus';
const FOCUS_NAME_PATTERN = /^(?:respectFocus|openFocusSettings|focusQuietNow)/;
const COPY_NAME_PATTERN = /static var (\w+): String \{ Localized\.text\(/g;
const RESPECT_FOCUS_DETAIL = 'Hold what todz shows on this Mac in a Focus that has the todz filter.';
const DAY_TEMPERATURE_DETAIL = 'Dims the menu bar count through the afternoon and tints overdue widget rows.';

const settingsCopy = readRepositoryFile(SETTINGS_COPY);
const copyNames = capturedNames({ text: settingsCopy, pattern: COPY_NAME_PATTERN });

describe('the Settings copy about Focus', () => {
  test('only the Respect Focus rows, the helper button and the quiet notice mention Focus', () => {
    const namesThatMentionFocus = copyNames.filter((name) => swiftCopyValue({ text: settingsCopy, name }).includes(FOCUS_WORD));
    const strayNames = namesThatMentionFocus.filter((name) => !FOCUS_NAME_PATTERN.test(name));
    expect(strayNames).toEqual([]);
    expect(namesThatMentionFocus).toContain('focusQuietNow');
    expect(namesThatMentionFocus).toContain('openFocusSettings');
  });

  test('the Respect Focus detail says what the switch holds', () => {
    expect(swiftCopyValue({ text: settingsCopy, name: 'respectFocusDetail' })).toBe(RESPECT_FOCUS_DETAIL);
  });

  test('the day temperature detail no longer mentions Focus', () => {
    expect(swiftCopyValue({ text: settingsCopy, name: 'dayTemperatureDetail' })).toBe(DAY_TEMPERATURE_DETAIL);
  });
});
