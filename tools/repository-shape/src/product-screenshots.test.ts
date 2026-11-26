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
const HERO_SCREENSHOT = 'docs/screenshots/motion/01-add-and-complete.gif';
const PNG_EXTENSION = '.png';
const GIF_EXTENSION = '.gif';
const GIF_WIDTH_OFFSET = 6;
const GIF_MAX_BYTES = 2 * 1024 * 1024;
const SCREENSHOT_PATH_PATTERN = /^docs\/screenshots\/(?<slug>[^/]+)\/\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*\.(?:png|gif)$/;
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

function pngWidth(path: string): number {
  const bytes = readFileSync(repositoryPath(path));
  if (path.endsWith(GIF_EXTENSION)) return bytes.readUInt16LE(GIF_WIDTH_OFFSET);
  return bytes.readUInt32BE(WIDTH_OFFSET);
}

function byteLimit(path: string): number {
  return path.endsWith(GIF_EXTENSION) ? GIF_MAX_BYTES : MAX_BYTES;
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

  test('every file under docs/screenshots is a numbered png or gif inside a folder named for a feature', () => {
    expect(SCREENSHOTS.filter((path) => !isNamedForAFeature(path))).toEqual([]);
  });

  test.each(SCREENSHOTS)('%s is at most 1600 pixels wide and 1 MB (2 MB for a gif)', (path) => {
    expect(pngWidth(path)).toBeLessThanOrEqual(MAX_WIDTH_PIXELS);
    expect(statSync(repositoryPath(path)).size).toBeLessThanOrEqual(byteLimit(path));
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
    expect(pngWidth(path)).toBeLessThanOrEqual(MAX_WIDTH_PIXELS);
    expect(statSync(repositoryPath(path)).size).toBeLessThanOrEqual(MAX_BYTES);
  });

  test('every docs image is shown by a docs page', () => {
    const pages = docsPages();
    expect(DOCS_IMAGES.filter((path) => !pages.includes(posix.relative(DOCS_DIRECTORY, path)))).toEqual([]);
  });
});
