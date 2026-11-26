import { describe, expect, test } from 'vitest';
import { readRepositoryFile } from './repository-files';

const MENU_BAR_LABEL_SOURCE = 'apps/macos/Todz/MenuBar/MenuBarLabel.swift';
const LIVE_COUNT_STACK = 'HStack(spacing:';
const TONE_ONLY_BRANCH = 'toneBadgeText';
const IMAGE_COUNT_LABEL = 'MenuBarCountLabel(badgeText: badgeText, opacity: countOpacity, displayScale: displayScale)';

describe('the menu bar count label', () => {
  test('draws every count through the image path, because the status item drops the spacing of a live stack', () => {
    const label = readRepositoryFile(MENU_BAR_LABEL_SOURCE);
    expect(label).toContain(IMAGE_COUNT_LABEL);
    expect(label).not.toContain(LIVE_COUNT_STACK);
    expect(label).not.toContain(TONE_ONLY_BRANCH);
  });
});
