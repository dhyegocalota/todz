import { readdirSync, readFileSync, statSync } from 'node:fs';
import { posix } from 'node:path';
import { describe, expect, test } from 'vitest';
import { readRepositoryFile, repositoryFiles, repositoryPath } from './repository-files';

const README_FILE = 'README.md';
const SCREENSHOTS_FOLDER = 'docs/screenshots';
const FEATURES_FOLDER = 'docs/features';
const WALK_HEADING = '## A walk through todz';
const HERO_SCREENSHOT = 'docs/screenshots/mac-app-shell/04-inspector-notes-and-history.png';
const PNG_EXTENSION = '.png';
const SCREENSHOT_PATH_PATTERN = /^docs\/screenshots\/(?<slug>[^/]+)\/\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*\.png$/;
const WIDTH_OFFSET = 16;
const MAX_WIDTH_PIXELS = 1600;
const MAX_BYTES = 1024 * 1024;

const SCREENSHOTS = repositoryFiles(SCREENSHOTS_FOLDER);

function featureSlugs(): string[] {
  return readdirSync(repositoryPath(FEATURES_FOLDER), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function pngWidth(path: string): number {
  return readFileSync(repositoryPath(path)).readUInt32BE(WIDTH_OFFSET);
}

function isNamedForAFeature(path: string): boolean {
  const slug = SCREENSHOT_PATH_PATTERN.exec(path)?.groups?.slug;
  if (!slug) return false;
  return featureSlugs().includes(slug);
}

describe('product screenshots', () => {
  test('there are screenshots to check', () => {
    expect(SCREENSHOTS.length).toBeGreaterThan(0);
  });

  test('every file under docs/screenshots is a numbered png inside a folder named for a feature', () => {
    expect(SCREENSHOTS.filter((path) => !path.endsWith(PNG_EXTENSION) || !isNamedForAFeature(path))).toEqual([]);
  });

  test.each(SCREENSHOTS)('%s is at most 1600 pixels wide and 1 MB', (path) => {
    expect(pngWidth(path)).toBeLessThanOrEqual(MAX_WIDTH_PIXELS);
    expect(statSync(repositoryPath(path)).size).toBeLessThanOrEqual(MAX_BYTES);
  });

  test('the root README shows every screenshot', () => {
    const readme = readRepositoryFile(README_FILE);
    expect(SCREENSHOTS.filter((path) => !readme.includes(posix.normalize(path)))).toEqual([]);
  });

  test('the root README opens with the hero screenshot above the walk section', () => {
    const readme = readRepositoryFile(README_FILE);
    const heroIndex = readme.indexOf(`<img src="${HERO_SCREENSHOT}"`);
    expect(heroIndex).toBeGreaterThanOrEqual(0);
    expect(heroIndex).toBeLessThan(readme.indexOf(WALK_HEADING));
  });

  test('the root README has the walk section', () => {
    expect(readRepositoryFile(README_FILE)).toContain(`\n${WALK_HEADING}\n`);
  });
});
