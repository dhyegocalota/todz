import { existsSync, readFileSync } from 'node:fs';
import { posix } from 'node:path';
import { describe, expect, test } from 'vitest';
import { readRepositoryFile, repositoryPath } from './repository-files';

const ASSET_CATALOG = 'apps/macos/Todz/Assets.xcassets';
const APP_ICON_SET = posix.join(ASSET_CATALOG, 'AppIcon.appiconset');
const MENU_BAR_GLYPH_SET = posix.join(ASSET_CATALOG, 'MenuBarGlyph.imageset');
const CONTENTS_FILE = 'Contents.json';
const PDF_SIGNATURE = '%PDF-';
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WIDTH_OFFSET = 16;
const HEIGHT_OFFSET = 20;
const MACOS_IDIOM = 'mac';
const TEMPLATE_INTENT = 'template';
const REQUIRED_POINT_SIZES = [16, 32, 128, 256, 512];
const REQUIRED_SCALES = [1, 2];
const MENU_BAR_GLYPH_POINTS = 18;
const NUMBER = String.raw`(\d+(?:\.\d+)?)`;
const MEDIA_BOX_PATTERN = new RegExp(String.raw`/MediaBox\s*\[\s*${NUMBER}\s+${NUMBER}\s+${NUMBER}\s+${NUMBER}\s*\]`);

type AppIconImage = { filename?: string; idiom: string; scale: string; size: string };
type GlyphImage = { filename?: string; idiom: string };
type GlyphContents = {
  images: GlyphImage[];
  properties: { 'template-rendering-intent': string; 'preserves-vector-representation': boolean };
};

function readContents<Contents>(directory: string): Contents {
  return JSON.parse(readRepositoryFile(posix.join(directory, CONTENTS_FILE))) as Contents;
}

function appIconImages(): AppIconImage[] {
  return readContents<{ images: AppIconImage[] }>(APP_ICON_SET).images;
}

function pointSize(image: AppIconImage): number {
  return Number(image.size.split('x')[0]);
}

function scale(image: AppIconImage): number {
  return Number(image.scale.replace('x', ''));
}

function expectedPixels(image: AppIconImage): number {
  return pointSize(image) * scale(image);
}

function readFile(path: string): Buffer {
  return readFileSync(repositoryPath(path));
}

function pngDimensions(path: string): { width: number; height: number } {
  const bytes = readFile(path);
  return { width: bytes.readUInt32BE(WIDTH_OFFSET), height: bytes.readUInt32BE(HEIGHT_OFFSET) };
}

function isPng(path: string): boolean {
  return readFile(path).subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE);
}

function imageFilename(image: AppIconImage): string {
  if (!image.filename) throw new Error(`${image.size} at ${image.scale} names no file`);
  return posix.join(APP_ICON_SET, image.filename);
}

describe('brand assets', () => {
  test('the app icon set covers every macOS size at 1x and 2x', () => {
    const covered = appIconImages().map((image) => `${pointSize(image)}@${scale(image)}`);
    const required = REQUIRED_POINT_SIZES.flatMap((size) => REQUIRED_SCALES.map((factor) => `${size}@${factor}`));
    expect(covered.sort()).toEqual(required.sort());
  });

  test('every app icon image uses the macOS idiom and names a file that exists', () => {
    const images = appIconImages();
    expect(images.filter((image) => image.idiom !== MACOS_IDIOM)).toEqual([]);
    expect(images.filter((image) => !image.filename || !existsSync(repositoryPath(imageFilename(image))))).toEqual([]);
  });

  test('every app icon file is a png at the pixel size its size and scale give', () => {
    const files = appIconImages().map((image) => {
      const filename = imageFilename(image);
      return { image, filename, ...pngDimensions(filename) };
    });
    const wrong = files.filter(({ filename }) => !isPng(filename)).map(({ filename }) => filename);
    const mismatched = files
      .filter(({ image, width, height }) => width !== expectedPixels(image) || height !== expectedPixels(image))
      .map(({ filename }) => filename);
    expect(wrong).toEqual([]);
    expect(mismatched).toEqual([]);
  });

  test('the menu bar glyph is one pdf that tints with the menu bar and keeps its vectors', () => {
    const contents = readContents<GlyphContents>(MENU_BAR_GLYPH_SET);
    expect(contents.images).toHaveLength(1);
    const [image] = contents.images;
    expect(image!.filename).toMatch(/\.pdf$/);
    expect(contents.properties['template-rendering-intent']).toBe(TEMPLATE_INTENT);
    expect(contents.properties['preserves-vector-representation']).toBe(true);
    const header = readFile(posix.join(MENU_BAR_GLYPH_SET, image!.filename!)).toString('latin1', 0, PDF_SIGNATURE.length);
    expect(header).toBe(PDF_SIGNATURE);
  });

  test('the menu bar glyph page is 18 points square', () => {
    const [image] = readContents<GlyphContents>(MENU_BAR_GLYPH_SET).images;
    const pdf = readFile(posix.join(MENU_BAR_GLYPH_SET, image!.filename!)).toString('latin1');
    const mediaBox = pdf.match(MEDIA_BOX_PATTERN);
    expect(mediaBox).not.toBeNull();
    expect(mediaBox!.slice(1).map(Number)).toEqual([0, 0, MENU_BAR_GLYPH_POINTS, MENU_BAR_GLYPH_POINTS]);
  });
});
