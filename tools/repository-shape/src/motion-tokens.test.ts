import { posix } from 'node:path';
import { describe, expect, test } from 'vitest';
import { readRepositoryFile, repositoryFiles } from './repository-files';

const APP_SOURCES_FOLDER = 'apps/macos';
const SWIFT_EXTENSION = '.swift';
const MOTION_MODIFIERS_FOLDER = 'apps/macos/TodzKit/Sources/TodzKit';
const MOTION_MODIFIERS_PREFIX = 'TodzMotion';
const TIMING_OWNERS = ['apps/macos/Todz/MainWindow/TitleFlightFrames.swift', 'apps/macos/Todz/MainWindowState.swift'];
const MOTION_BYPASSES = [
  { name: 'withAnimation', pattern: /\bwithAnimation\(/ },
  { name: 'a bare .animation modifier', pattern: /\.animation\(/ },
  { name: 'the .default animation', pattern: /\bnil\s*:\s*\.default\b/ },
  { name: 'a raw numericText transition', pattern: /\.numericText\(/ },
];

function isMotionModifierFile(path: string): boolean {
  return posix.dirname(path) === MOTION_MODIFIERS_FOLDER && posix.basename(path).startsWith(MOTION_MODIFIERS_PREFIX);
}

function bypassingFiles({ name, pattern }: { name: string; pattern: RegExp }): string[] {
  return repositoryFiles(APP_SOURCES_FOLDER)
    .filter((path) => path.endsWith(SWIFT_EXTENSION) && !isMotionModifierFile(path) && !TIMING_OWNERS.includes(path))
    .filter((path) => pattern.test(readRepositoryFile(path)))
    .map((path) => `${path}: ${name}`);
}

describe('the motion tokens are the only way to animate', () => {
  test.each(MOTION_BYPASSES)('no view uses $name outside the TodzKit motion modifiers', (bypass) => {
    expect(bypassingFiles(bypass)).toEqual([]);
  });

  test('the modifiers file still exists, so the allowance is not an empty folder', () => {
    expect(repositoryFiles(MOTION_MODIFIERS_FOLDER).filter(isMotionModifierFile).length).toBeGreaterThan(0);
  });
});
