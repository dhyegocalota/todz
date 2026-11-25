import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { afterEach, describe, expect, test } from 'vitest';
import { REGENERATE_COMMAND, staleInputsOf } from '../../scripts/site-assets/site-assets';
import { OPEN_GRAPH_IMAGE, SITE_ICONS, SiteIcon, IconPurpose } from '../../src/site/site-icons';
import { LANDING_SHOTS } from '../../src/site/landing-shots';

const REPOSITORY_ROOT = join(import.meta.dirname, '..', '..', '..', '..');
const API_DIRECTORY = join(REPOSITORY_ROOT, 'apps', 'api');
const PUBLIC_DIRECTORY = join(API_DIRECTORY, 'public');
const LOCK_PATH = 'apps/api/scripts/site-assets/site-assets.lock.json';
const CLI_PATH = join(API_DIRECTORY, 'scripts', 'site-assets', 'cli.ts');
const BRAND_ICON_PATH = join(REPOSITORY_ROOT, 'docs', 'brand', 'todz-icon.svg');
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const IHDR_WIDTH_OFFSET = 16;
const FAVICON_SIZES = [16, 32, 48];
const ICO_HEADER_LENGTH = 6;
const ICO_ENTRY_LENGTH = 16;
const OPAQUE_ALPHA = 255;
const RGBA_COLOR_TYPE = 6;
const PNG_MEDIA_TYPE = 'image/png';
const NEAR_WHITE_CHANNEL = 0xf0;
const SAFE_ZONE_RADIUS_RATIO = 0.4;
const OPEN_GRAPH_MAXIMUM_BYTES = 600 * 1024;
const DARK_SCHEME_RULE = '@media (prefers-color-scheme: dark)';
const TEMPORARY_ROOT_PREFIX = 'site-assets-';
const MUTATED_INPUT_PREFIXES = [
  'docs/brand/',
  'apps/api/public/landing/',
  'apps/api/src/site/site-icons.ts',
  'apps/api/src/site/landing-shots.ts',
  'apps/api/scripts/site-assets/site-assets.ts',
];
const WEBP_FORMS = { lossy: 'VP8 ', extended: 'VP8X', lossless: 'VP8L' };

type Picture = { width: number; height: number; channels: number; data: Buffer };

function committedBytes(relativePath: string): Buffer {
  const path = join(PUBLIC_DIRECTORY, relativePath);
  expect(existsSync(path), `${path} exists`).toBe(true);
  return readFileSync(path);
}

function paeth({ left, above, aboveLeft }: { left: number; above: number; aboveLeft: number }): number {
  const estimate = left + above - aboveLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const aboveLeftDistance = Math.abs(estimate - aboveLeft);
  if (leftDistance <= aboveDistance && leftDistance <= aboveLeftDistance) return left;
  if (aboveDistance <= aboveLeftDistance) return above;
  return aboveLeft;
}

enum PngFilter {
  None = 0,
  Left = 1,
  Above = 2,
  Average = 3,
}

function predictionOf({ filter, left, above, aboveLeft }: { filter: number; left: number; above: number; aboveLeft: number }): number {
  if (filter === PngFilter.None) return 0;
  if (filter === PngFilter.Left) return left;
  if (filter === PngFilter.Above) return above;
  if (filter === PngFilter.Average) return (left + above) >> 1;
  return paeth({ left, above, aboveLeft });
}

function idatChunksOf({ bytes, offset }: { bytes: Buffer; offset: number }): Buffer[] {
  if (offset >= bytes.length) return [];
  const length = bytes.readUInt32BE(offset);
  const type = bytes.toString('ascii', offset + 4, offset + 8);
  const rest = idatChunksOf({ bytes, offset: offset + length + 12 });
  if (type !== 'IDAT') return rest;
  return [bytes.subarray(offset + 8, offset + 8 + length), ...rest];
}

function decodedPng(bytes: Buffer): Picture {
  expect(bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)).toBe(true);
  const width = bytes.readUInt32BE(IHDR_WIDTH_OFFSET);
  const height = bytes.readUInt32BE(IHDR_WIDTH_OFFSET + 4);
  const colorType = bytes.readUInt8(IHDR_WIDTH_OFFSET + 9);
  const channels = colorType === RGBA_COLOR_TYPE ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idatChunksOf({ bytes, offset: PNG_SIGNATURE.length })));
  const stride = width * channels;
  const emptyRow = Buffer.alloc(stride);
  const { rows } = Array.from({ length: height }).reduce<{ rows: Buffer[]; previous: Buffer }>(
    ({ rows: decodedRows, previous }, _, row) => {
      const filter = raw.readUInt8(row * (stride + 1));
      const current = Buffer.alloc(stride);
      Array.from({ length: stride }).forEach((__, column) => {
        const left = column >= channels ? current.readUInt8(column - channels) : 0;
        const aboveLeft = column >= channels ? previous.readUInt8(column - channels) : 0;
        const prediction = predictionOf({ filter, left, above: previous.readUInt8(column), aboveLeft });
        current.writeUInt8((raw.readUInt8(row * (stride + 1) + 1 + column) + prediction) & 0xff, column);
      });
      return { rows: [...decodedRows, current], previous: current };
    },
    { rows: [], previous: emptyRow },
  );
  return { width, height, channels, data: Buffer.concat(rows) };
}

type Pixel = { red: number; green: number; blue: number; alpha: number };

function pixelAt({ picture, x, y }: { picture: Picture; x: number; y: number }): Pixel {
  const start = (y * picture.width + x) * picture.channels;
  const alpha = picture.channels === 4 ? picture.data.readUInt8(start + 3) : OPAQUE_ALPHA;
  return { red: picture.data.readUInt8(start), green: picture.data.readUInt8(start + 1), blue: picture.data.readUInt8(start + 2), alpha };
}

function allPixels(picture: Picture): { x: number; y: number; pixel: Pixel }[] {
  return Array.from({ length: picture.width * picture.height }, (_, index) => {
    const x = index % picture.width;
    const y = Math.floor(index / picture.width);
    return { x, y, pixel: pixelAt({ picture, x, y }) };
  });
}

function hasVisiblePixel(pixels: { pixel: Pixel }[]): boolean {
  return pixels.some(({ pixel }) => pixel.alpha > 0);
}

function webpWidthOf(bytes: Buffer): number {
  expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
  expect(bytes.toString('ascii', 8, 12)).toBe('WEBP');
  const form = bytes.toString('ascii', 12, 16);
  if (form === WEBP_FORMS.lossy) return bytes.readUInt16LE(26) & 0x3fff;
  if (form === WEBP_FORMS.extended) return 1 + bytes.readUIntLE(24, 3);
  if (form === WEBP_FORMS.lossless) return 1 + (bytes.readUInt8(21) | ((bytes.readUInt8(22) & 0x3f) << 8));
  throw new Error(`unknown WebP form ${form}`);
}

const PNG_ICONS = Object.values(SiteIcon).flatMap((icon) => {
  const { size, ...file } = SITE_ICONS[icon];
  return size === null || file.mediaType !== PNG_MEDIA_TYPE ? [] : [{ icon, size, ...file }];
});

describe('the icons the head and the manifest name', () => {
  test.each(Object.values(SiteIcon))('%s exists under public', (icon) => {
    expect(committedBytes(SITE_ICONS[icon].path).length).toBeGreaterThan(0);
  });

  test.each(PNG_ICONS)('$path is a PNG whose IHDR size is the recorded $size', ({ path, size }) => {
    const picture = decodedPng(committedBytes(path));
    expect([picture.width, picture.height]).toEqual([size, size]);
  });
});

describe('favicon.ico', () => {
  const ico = () => committedBytes(SITE_ICONS[SiteIcon.Favicon].path);

  test('is an ICO of three entries: 16, 32 and 48', () => {
    const bytes = ico();
    expect([bytes.readUInt16LE(0), bytes.readUInt16LE(2), bytes.readUInt16LE(4)]).toEqual([0, 1, FAVICON_SIZES.length]);
    const widths = FAVICON_SIZES.map((_, index) => bytes.readUInt8(ICO_HEADER_LENGTH + index * ICO_ENTRY_LENGTH));
    expect(widths).toEqual(FAVICON_SIZES);
  });

  test.each(FAVICON_SIZES.map((size, index) => ({ size, index })))(
    'the $size entry is a PNG with a non-transparent pixel on every edge, the margin cropped',
    ({ size, index }) => {
      const bytes = ico();
      const entryStart = ICO_HEADER_LENGTH + index * ICO_ENTRY_LENGTH;
      const length = bytes.readUInt32LE(entryStart + 8);
      const offset = bytes.readUInt32LE(entryStart + 12);
      const picture = decodedPng(bytes.subarray(offset, offset + length));
      const pixels = allPixels(picture);
      expect([picture.width, picture.height]).toEqual([size, size]);
      expect(hasVisiblePixel(pixels.filter(({ y }) => y === 0))).toBe(true);
      expect(hasVisiblePixel(pixels.filter(({ y }) => y === size - 1))).toBe(true);
      expect(hasVisiblePixel(pixels.filter(({ x }) => x === 0))).toBe(true);
      expect(hasVisiblePixel(pixels.filter(({ x }) => x === size - 1))).toBe(true);
    },
  );
});

describe('icon.svg', () => {
  const svg = () => committedBytes(SITE_ICONS[SiteIcon.Vector].path).toString('utf8');
  const brandPathData = [...readFileSync(BRAND_ICON_PATH, 'utf8').matchAll(/<path d="([^"]+)"/g)].map((match) => match[1]);

  test('holds the check and spark paths of docs/brand/todz-icon.svg', () => {
    expect(brandPathData).toHaveLength(2);
    brandPathData.forEach((pathData) => expect(svg()).toContain(`d="${pathData}"`));
  });

  test('lifts the gradient under prefers-color-scheme: dark', () => {
    expect(svg()).toContain(DARK_SCHEME_RULE);
  });
});

describe('the full-bleed icons', () => {
  const FULL_BLEED_ICONS = PNG_ICONS.filter(({ icon, purpose }) => icon === SiteIcon.AppleTouch || purpose === IconPurpose.Maskable);

  test.each(FULL_BLEED_ICONS)('$path has no transparent pixel', ({ path }) => {
    const pixels = allPixels(decodedPng(committedBytes(path)));
    expect(pixels.filter(({ pixel }) => pixel.alpha !== OPAQUE_ALPHA)).toEqual([]);
  });

  test.each(FULL_BLEED_ICONS)(
    '$path keeps every pixel whiter than #F0F0F0 inside the centred circle of radius 0.4 of its side',
    ({ path, size }) => {
      const pixels = allPixels(decodedPng(committedBytes(path)));
      const radius = SAFE_ZONE_RADIUS_RATIO * size;
      const centre = size / 2;
      const whitePixels = pixels.filter(({ pixel }) =>
        [pixel.red, pixel.green, pixel.blue].every((channel) => channel > NEAR_WHITE_CHANNEL),
      );
      const outsidePixels = whitePixels.filter(({ x, y }) => Math.hypot(x + 0.5 - centre, y + 0.5 - centre) > radius);
      expect(whitePixels.length).toBeGreaterThan(0);
      expect(outsidePixels).toEqual([]);
    },
  );
});

describe('the Open Graph image', () => {
  test('is a 1200 by 630 PNG under 600 KB', () => {
    const bytes = committedBytes(OPEN_GRAPH_IMAGE.path);
    const picture = decodedPng(bytes);
    expect([picture.width, picture.height]).toEqual([OPEN_GRAPH_IMAGE.width, OPEN_GRAPH_IMAGE.height]);
    expect(bytes.length).toBeLessThan(OPEN_GRAPH_MAXIMUM_BYTES);
  });
});

describe('the landing shots as WebP', () => {
  const copies = Object.entries(LANDING_SHOTS).flatMap(([shot, { path, webp }]) => webp.map((copy) => ({ shot, source: path, ...copy })));

  test.each(copies)('$path exists at width $width and is smaller than its PNG', ({ path, width, source }) => {
    const bytes = committedBytes(path);
    expect(webpWidthOf(bytes)).toBe(width);
    expect(bytes.length).toBeLessThan(committedBytes(source).length);
  });
});

describe('site:assets:check', () => {
  const temporaryRoots: string[] = [];

  afterEach(() => {
    temporaryRoots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }));
  });

  function lockedInputs(): string[] {
    expect(existsSync(join(REPOSITORY_ROOT, LOCK_PATH)), `${LOCK_PATH} exists`).toBe(true);
    return Object.keys(JSON.parse(readFileSync(join(REPOSITORY_ROOT, LOCK_PATH), 'utf8')).inputs);
  }

  function copiedRootWithChangedInput(changedInput: string): string {
    const root = mkdtempSync(join(tmpdir(), TEMPORARY_ROOT_PREFIX));
    temporaryRoots.push(root);
    [...lockedInputs(), LOCK_PATH].forEach((relativePath) => {
      const target = join(root, relativePath);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, readFileSync(join(REPOSITORY_ROOT, relativePath)));
    });
    const changedPath = join(root, changedInput);
    const changedBytes = readFileSync(changedPath);
    changedBytes.writeUInt8(changedBytes.readUInt8(0) ^ 1, 0);
    writeFileSync(changedPath, changedBytes);
    return root;
  }

  function checkRun(root: string) {
    return spawnSync(process.execPath, ['--import', 'tsx', CLI_PATH, 'check', root], { cwd: API_DIRECTORY, encoding: 'utf8' });
  }

  test('exits 0 on the committed tree', () => {
    const run = checkRun(REPOSITORY_ROOT);
    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
  });

  test('locks the docs/brand files, the shots, both constant modules and the generator source', () => {
    const inputs = lockedInputs();
    MUTATED_INPUT_PREFIXES.forEach((prefix) => expect(inputs.some((input) => input.startsWith(prefix))).toBe(true));
    expect(inputs.filter((input) => input.startsWith('apps/api/scripts/site-assets/'))).toEqual(
      expect.arrayContaining(
        ['cli.ts', 'ico-file.ts', 'png-size.ts', 'site-assets.ts'].map((file) => `apps/api/scripts/site-assets/${file}`),
      ),
    );
  });

  test.each(MUTATED_INPUT_PREFIXES)('names the stale input when one byte of %s changes', (prefix) => {
    const changedInput = lockedInputs().find((input) => input.startsWith(prefix))!;
    const root = copiedRootWithChangedInput(changedInput);
    expect(staleInputsOf({ root })).toEqual([changedInput]);
  });

  test('exits 1 naming the stale input and the regenerate command', () => {
    const changedInput = lockedInputs().find((input) => input.startsWith('docs/brand/'))!;
    const run = checkRun(copiedRootWithChangedInput(changedInput));
    expect(run.status).toBe(1);
    expect(run.stderr).toContain(changedInput);
    expect(run.stderr).toContain(REGENERATE_COMMAND);
  });
});
