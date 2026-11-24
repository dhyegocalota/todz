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
const APP_ICON_DOCUMENT = 'apps/macos/Todz/AppIcon.icon';
const APP_ICON_ASSETS = posix.join(APP_ICON_DOCUMENT, 'Assets');
const BRAND_DIRECTORY = 'docs/brand';
const WIDGET_VIEWS = 'apps/macos/TodzWidgets/Views';
const WIDGET_BRAND_GLYPH = 'WidgetBrandGlyph';
const WIDGET_BRAND_GLYPH_FILE = posix.join(WIDGET_VIEWS, `${WIDGET_BRAND_GLYPH}.swift`);
const WIDGET_TITLE_FILES = ['WidgetHeader.swift', 'WidgetPrompt.swift', 'NextUpView.swift', 'TodayRing.swift'];
const MACOS_PLATFORM = 'macOS';
const ICON_LAYER_NAMES = ['sparkle', 'check'];
const ICON_GRADIENT = ['#4C6BFF', '#1B2A9E'];
const ICON_LAYER_VIEW_BOX = '80 80 864 864';
const ICON_LAYER_PIXELS = '1024';
const COLOR_CHANNEL_MAXIMUM = 255;
const COLOR_CHANNEL_COUNT = 3;
const HEX_RADIX = 16;
const HEX_DIGITS_PER_CHANNEL = 2;
const NUMBER = String.raw`(\d+(?:\.\d+)?)`;
const MEDIA_BOX_PATTERN = new RegExp(String.raw`/MediaBox\s*\[\s*${NUMBER}\s+${NUMBER}\s+${NUMBER}\s+${NUMBER}\s*\]`);

type AppIconImage = { filename?: string; idiom: string; scale: string; size: string };
type IconLayer = { glass?: boolean; 'image-name': string; name: string };
type IconDocument = {
  fill: { 'linear-gradient': string[] };
  groups: { layers: IconLayer[] }[];
  'supported-platforms': { squares: string[] };
};
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

function iconDocument(): IconDocument {
  return JSON.parse(readRepositoryFile(posix.join(APP_ICON_DOCUMENT, 'icon.json'))) as IconDocument;
}

function iconLayers(): IconLayer[] {
  return iconDocument().groups.flatMap((group) => group.layers);
}

function iconLayerAsset(layer: IconLayer): string {
  return posix.join(APP_ICON_ASSETS, layer['image-name']);
}

function brandLayerSource(layerName: string): string {
  return posix.join(BRAND_DIRECTORY, `todz-icon-${layerName}.svg`);
}

function hexOfSrgb(components: string): string {
  const channels = components
    .replace('srgb:', '')
    .split(',')
    .slice(0, COLOR_CHANNEL_COUNT)
    .map((channel) =>
      Math.round(Number(channel) * COLOR_CHANNEL_MAXIMUM)
        .toString(HEX_RADIX)
        .padStart(HEX_DIGITS_PER_CHANNEL, '0'),
    );
  return `#${channels.join('').toUpperCase()}`;
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

  test('the layered app icon is made for macOS', () => {
    expect(iconDocument()['supported-platforms'].squares).toContain(MACOS_PLATFORM);
  });

  test('the layered app icon fills with a linear gradient from the brand blue to the deep blue', () => {
    expect(iconDocument().fill['linear-gradient'].map(hexOfSrgb)).toEqual(ICON_GRADIENT);
  });

  test('the layered app icon holds a sparkle group and a check group, each one glass layer', () => {
    const groups = iconDocument().groups;
    expect(groups.map((group) => group.layers.map((layer) => layer.name))).toEqual(ICON_LAYER_NAMES.map((name) => [name]));
    expect(groups.map((group) => group.layers.map((layer) => layer.glass))).toEqual(ICON_LAYER_NAMES.map(() => [true]));
  });

  test('every layer of the layered app icon names an image that exists in its assets', () => {
    expect(iconLayers().filter((layer) => !existsSync(repositoryPath(iconLayerAsset(layer))))).toEqual([]);
  });

  test('every layer image is a byte copy of its brand source at the squircle view box', () => {
    const layers = iconLayers();
    expect(layers).not.toHaveLength(0);
    layers.forEach((layer) => {
      const image = readFile(iconLayerAsset(layer));
      const svg = image.toString('utf8');
      expect(image.equals(readFile(brandLayerSource(layer.name)))).toBe(true);
      expect(svg).toContain(`viewBox="${ICON_LAYER_VIEW_BOX}"`);
      expect(svg).toContain(`width="${ICON_LAYER_PIXELS}"`);
      expect(svg).toContain(`height="${ICON_LAYER_PIXELS}"`);
    });
  });

  test('the widget titles draw the todz glyph before their text', () => {
    const missing = WIDGET_TITLE_FILES.filter(
      (file) => !readRepositoryFile(posix.join(WIDGET_VIEWS, file)).includes(`${WIDGET_BRAND_GLYPH}(`),
    );
    expect(missing).toEqual([]);
  });

  test('the widget glyph names an image set that exists in the catalog', () => {
    const imageSetName = readRepositoryFile(WIDGET_BRAND_GLYPH_FILE).match(/Image\("([^"]+)"\)/)?.[1];
    expect(imageSetName).toBeDefined();
    expect(existsSync(repositoryPath(posix.join(ASSET_CATALOG, `${imageSetName}.imageset`)))).toBe(true);
  });
});
