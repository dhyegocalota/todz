import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { posix } from 'node:path';
import { describe, expect, test } from 'vitest';
import { capturedNames, readRepositoryFile, repositoryFiles, repositoryPath } from './repository-files';

const README_FILE = 'README.md';
const SCREENSHOTS_FOLDER = 'docs/screenshots';
const FEATURES_FOLDER = 'docs/features';
const INSTALL_HEADING = '## Install';
const SERVED_FOLDER = 'apps/api/public/landing';
const DOCS_IMAGES_FOLDER = 'apps/docs/images';
const DOCS_DIRECTORY = 'apps/docs';
const DOCS_PAGE_EXTENSION = '.mdx';
const README_SCREENSHOT_LIMIT = 6;
const PICTURE_PATTERN = /<picture>[\s\S]*?<\/picture>/g;
const PICTURE_SOURCE_PATTERN = /(?:src|srcset)="([^"]+)"/g;
const DOCS_IMAGE_PATH_PATTERN = /^apps\/docs\/images\/(?<slug>[^/]+)\/\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*\.png$/;
const HERO_SCREENSHOT = 'docs/screenshots/motion/01-add-and-complete.webp';
const PNG_EXTENSION = '.png';
const ANIMATION_EXTENSION = '.webp';
const ANIMATION_WIDTH_OFFSET = 24;
const ANIMATION_WIDTH_BYTES = 3;
const ANIMATION_MAX_BYTES = 4 * 1024 * 1024;
const ANIMATION_MAX_WIDTH_PIXELS = 1640;
const HERO_DISPLAY_WIDTH = 820;
const HERO_PIXEL_RATIO = 2;
const SCREENSHOT_PATH_PATTERN = /^docs\/screenshots\/(?<slug>[^/]+)\/\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*\.(?:png|webp)$/;
const WIDTH_OFFSET = 16;
const MAX_WIDTH_PIXELS = 1600;
const MAX_BYTES = 1024 * 1024;

const SCREENSHOTS = repositoryFiles(SCREENSHOTS_FOLDER);
const DOCS_IMAGES = repositoryFiles(DOCS_IMAGES_FOLDER);
const SERVED = repositoryFiles(SERVED_FOLDER)
  .filter((path) => path.endsWith(PNG_EXTENSION))
  .map((path) => posix.join(SCREENSHOTS_FOLDER, posix.relative(SERVED_FOLDER, path)));

function featureSlugs(): string[] {
  return readdirSync(repositoryPath(FEATURES_FOLDER), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function imageWidth(path: string): number {
  const bytes = readFileSync(repositoryPath(path));
  if (path.endsWith(ANIMATION_EXTENSION)) return bytes.readUIntLE(ANIMATION_WIDTH_OFFSET, ANIMATION_WIDTH_BYTES) + 1;
  return bytes.readUInt32BE(WIDTH_OFFSET);
}

function byteLimit(path: string): number {
  return path.endsWith(ANIMATION_EXTENSION) ? ANIMATION_MAX_BYTES : MAX_BYTES;
}

function widthLimit(path: string): number {
  return path.endsWith(ANIMATION_EXTENSION) ? ANIMATION_MAX_WIDTH_PIXELS : MAX_WIDTH_PIXELS;
}

function isNamedForAFeature(path: string): boolean {
  const slug = SCREENSHOT_PATH_PATTERN.exec(path)?.groups?.slug;
  if (!slug) return false;
  return featureSlugs().includes(slug);
}

function isDocsImageOfAFeature(path: string): boolean {
  const slug = DOCS_IMAGE_PATH_PATTERN.exec(path)?.groups?.slug;
  if (!slug) return false;
  return featureSlugs().includes(slug);
}

function docsPages(): string {
  return repositoryFiles(DOCS_DIRECTORY)
    .filter((path) => path.endsWith(DOCS_PAGE_EXTENSION))
    .map(readRepositoryFile)
    .join('\n');
}

describe('product screenshots', () => {
  test('there are screenshots to check', () => {
    expect(SCREENSHOTS.length).toBeGreaterThan(0);
  });

  test('every file under docs/screenshots is a numbered png or animated webp inside a folder named for a feature', () => {
    expect(SCREENSHOTS.filter((path) => !isNamedForAFeature(path))).toEqual([]);
  });

  test.each(SCREENSHOTS)('%s is at most 1600 pixels wide and 1 MB (1640 pixels and 4 MB for an animated webp)', (path) => {
    expect(imageWidth(path)).toBeLessThanOrEqual(widthLimit(path));
    expect(statSync(repositoryPath(path)).size).toBeLessThanOrEqual(byteLimit(path));
  });

  test('the hero animation is drawn at twice the width the README displays it at', () => {
    const readme = readRepositoryFile(README_FILE);
    expect(readme).toContain(`<img src="${HERO_SCREENSHOT}" width="${HERO_DISPLAY_WIDTH}"`);
    expect(imageWidth(HERO_SCREENSHOT)).toBe(HERO_DISPLAY_WIDTH * HERO_PIXEL_RATIO);
  });

  test('every screenshot is shown by the root README or served by the landing', () => {
    const readme = readRepositoryFile(README_FILE);
    expect(SCREENSHOTS.filter((path) => !readme.includes(path) && !SERVED.includes(path))).toEqual([]);
  });

  test('the root README shows at most six screenshots', () => {
    const readme = readRepositoryFile(README_FILE);
    expect(SCREENSHOTS.filter((path) => readme.includes(path)).length).toBeLessThanOrEqual(README_SCREENSHOT_LIMIT);
  });

  test('the root README opens with the hero screenshot above the install section', () => {
    const readme = readRepositoryFile(README_FILE);
    const heroIndex = readme.indexOf(`<img src="${HERO_SCREENSHOT}"`);
    expect(heroIndex).toBeGreaterThanOrEqual(0);
    expect(heroIndex).toBeLessThan(readme.indexOf(`\n${INSTALL_HEADING}\n`));
  });

  test('every source of a picture in the root README exists', () => {
    const pictures = readRepositoryFile(README_FILE).match(PICTURE_PATTERN);
    expect(pictures).not.toBeNull();
    const sources = pictures!.flatMap((text) => capturedNames({ text, pattern: PICTURE_SOURCE_PATTERN }));
    expect(sources.filter((path) => !existsSync(repositoryPath(path)))).toEqual([]);
  });
});

describe('docs images', () => {
  test('there are docs images to check', () => {
    expect(DOCS_IMAGES.length).toBeGreaterThan(0);
  });

  test('every file under apps/docs/images is a numbered png inside a folder named for a feature', () => {
    expect(DOCS_IMAGES.filter((path) => !isDocsImageOfAFeature(path))).toEqual([]);
  });

  test.each(DOCS_IMAGES)('%s is at most 1600 pixels wide and 1 MB', (path) => {
    expect(imageWidth(path)).toBeLessThanOrEqual(MAX_WIDTH_PIXELS);
    expect(statSync(repositoryPath(path)).size).toBeLessThanOrEqual(MAX_BYTES);
  });

  test('every docs image is shown by a docs page', () => {
    const pages = docsPages();
    expect(DOCS_IMAGES.filter((path) => !pages.includes(posix.relative(DOCS_DIRECTORY, path)))).toEqual([]);
  });
});
