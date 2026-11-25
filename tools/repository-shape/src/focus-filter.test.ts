import { describe, expect, test } from 'vitest';
import { readRepositoryFile } from './repository-files';

const FOCUS_FILTER_SOURCE = 'apps/macos/Todz/FocusFilter/TodzFocusFilter.swift';
const DISCOVERY_OVERRIDE = 'isDiscoverable';

describe('the Focus filter', () => {
  test('keeps the default discoverability, so the owner can add it in System Settings', () => {
    expect(readRepositoryFile(FOCUS_FILTER_SOURCE)).not.toContain(DISCOVERY_OVERRIDE);
  });
});
