import { describe, expect, test } from 'vitest';
import { readRepositoryFile } from './repository-files';

const FOCUS_FILTER_SOURCE = 'apps/macos/Todz/FocusFilter/TodzFocusFilter.swift';
const HIDDEN_FROM_DISCOVERY_PATTERN = /isDiscoverable\s*(:\s*Bool\s*)?=\s*false/;

describe('the Focus filter', () => {
  test('stays discoverable, so the owner can add it in System Settings', () => {
    expect(readRepositoryFile(FOCUS_FILTER_SOURCE)).not.toMatch(HIDDEN_FROM_DISCOVERY_PATTERN);
  });
});
