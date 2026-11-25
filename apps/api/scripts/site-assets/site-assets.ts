import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Browser } from '@playwright/test';
import { LANDING_SHOTS, LandingShot } from '../../src/site/landing-shots';
import { OPEN_GRAPH_IMAGE, SITE_ICONS, SiteIcon } from '../../src/site/site-icons';
import { icoBytes } from './ico-file';

export const REPOSITORY_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
export const REGENERATE_COMMAND = 'pnpm --filter @todz/api site:assets';

const BRAND_DIRECTORY = 'docs/brand';
const BRAND_ICON_FILE = 'todz-icon.svg';
const BRAND_LOCKUP_FILE = 'todz-lockup.png';
const PUBLIC_DIRECTORY = 'apps/api/public';
const GENERATOR_DIRECTORY = 'apps/api/scripts/site-assets';
const GENERATOR_SOURCE_PATTERN = /\.ts$/;
const LOCK_PATH = `${GENERATOR_DIRECTORY}/site-assets.lock.json`;
const CONSTANT_MODULE_PATHS = ['apps/api/src/site/site-icons.ts', 'apps/api/src/site/landing-shots.ts'];
const WEBP_QUALITY = 0.82;
const WEBP_MEDIA_TYPE = 'image/webp';
const FAVICON_SIZES = [16, 32, 48];
const SQUIRCLE = { start: 80, side: 864 };
const BRAND_VIEW_BOX_ATTRIBUTES = 'viewBox="0 0 1024 1024" width="1024" height="1024"';
const BRAND_DEFS_PATTERN = /<defs>[\s\S]*<\/defs>/;
const BRAND_MARK_PATTERN = /<g filter="url\(#shadow\)">[\s\S]*<\/g>/;
const BRAND_DEFS_OPENING = '<defs>';
const GRADIENT_START_STOP = '<stop offset="0" stop-color="#4C6BFF"/>';
const GRADIENT_END_STOP = '<stop offset="1" stop-color="#1B2A9E"/>';
const DARK_GRADIENT_RULE =
  '<style>@media (prefers-color-scheme: dark){.gradient-start{stop-color:#6F89FF}.gradient-end{stop-color:#3446C8}}</style>';
const MARK_BOX = { x: 252, y: 214, width: 620, height: 514 };
const MARK_SPAN_RATIO = 0.77;
const OPEN_GRAPH_LOCKUP = { left: 300, top: 0, width: 600, height: 200 };
const OPEN_GRAPH_SHOT = { left: 160, top: 190, width: 880 };
const OPEN_GRAPH_SHOT_EDGE = '0 0 0 1px rgb(255 255 255 / 0.14), 0 30px 80px rgb(0 0 0 / 0.6)';

type HashesByInput = Record<string, string>;

function sha256Of(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function dataUrlOf({ bytes, mediaType }: { bytes: Buffer; mediaType: string }): string {
  return `data:${mediaType};base64,${bytes.toString('base64')}`;
}

function relativeFilesOf({ root, directory, pattern }: { root: string; directory: string; pattern: RegExp }): string[] {
  return readdirSync(join(root, directory))
    .filter((file) => pattern.test(file))
    .map((file) => `${directory}/${file}`);
}

function inputPathsOf({ root }: { root: string }): string[] {
  const brandPaths = relativeFilesOf({ root, directory: BRAND_DIRECTORY, pattern: /./ });
  const generatorPaths = relativeFilesOf({ root, directory: GENERATOR_DIRECTORY, pattern: GENERATOR_SOURCE_PATTERN });
  const shotPaths = Object.values(LANDING_SHOTS).map(({ path }) => `${PUBLIC_DIRECTORY}${path}`);
  return [...brandPaths, ...shotPaths, ...CONSTANT_MODULE_PATHS, ...generatorPaths].sort();
}

function hashesOf({ root }: { root: string }): HashesByInput {
  return Object.fromEntries(inputPathsOf({ root }).map((input) => [input, sha256Of(readFileSync(join(root, input)))]));
}

export function staleInputsOf({ root }: { root: string }): string[] {
  const current = hashesOf({ root });
  const lockPath = join(root, LOCK_PATH);
  if (!existsSync(lockPath)) return Object.keys(current);
  const locked: HashesByInput = JSON.parse(readFileSync(lockPath, 'utf8')).inputs;
  const inputs = [...new Set([...Object.keys(current), ...Object.keys(locked)])].sort();
  return inputs.filter((input) => current[input] !== locked[input]);
}

function replacedOnce({ source, search, replacement }: { source: string; search: string; replacement: string }): string {
  if (!source.includes(search)) throw new Error(`the brand icon no longer holds ${search}`);
  return source.replace(search, replacement);
}

function matchedOnce({ source, pattern }: { source: string; pattern: RegExp }): string {
  const match = source.match(pattern);
  if (match === null) throw new Error(`the brand icon no longer matches ${pattern}`);
  return match[0];
}

function brandIconSvg(): string {
  return readFileSync(join(REPOSITORY_ROOT, BRAND_DIRECTORY, BRAND_ICON_FILE), 'utf8');
}

function squircleSvg({ size }: { size: number }): string {
  const viewBox = `${SQUIRCLE.start} ${SQUIRCLE.start} ${SQUIRCLE.side} ${SQUIRCLE.side}`;
  return replacedOnce({
    source: brandIconSvg(),
    search: BRAND_VIEW_BOX_ATTRIBUTES,
    replacement: `viewBox="${viewBox}" width="${size}" height="${size}"`,
  });
}

function vectorIconSvg(): string {
  const classedStart = replacedOnce({
    source: squircleSvg({ size: SQUIRCLE.side }),
    search: GRADIENT_START_STOP,
    replacement: GRADIENT_START_STOP.replace('<stop', '<stop class="gradient-start"'),
  });
  const classedEnd = replacedOnce({
    source: classedStart,
    search: GRADIENT_END_STOP,
    replacement: GRADIENT_END_STOP.replace('<stop', '<stop class="gradient-end"'),
  });
  return replacedOnce({ source: classedEnd, search: BRAND_DEFS_OPENING, replacement: `${BRAND_DEFS_OPENING}${DARK_GRADIENT_RULE}` });
}

function fullBleedSvg({ size }: { size: number }): string {
  const brand = brandIconSvg();
  const side = MARK_BOX.width / MARK_SPAN_RATIO;
  const start = { x: MARK_BOX.x + (MARK_BOX.width - side) / 2, y: MARK_BOX.y + (MARK_BOX.height - side) / 2 };
  const box = `x="${start.x}" y="${start.y}" width="${side}" height="${side}"`;
  const fills = ['background', 'glow'].map((gradient) => `<rect ${box} fill="url(#${gradient})"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${start.x} ${start.y} ${side} ${side}" width="${size}" height="${size}">${matchedOnce({ source: brand, pattern: BRAND_DEFS_PATTERN })}${fills}${matchedOnce({ source: brand, pattern: BRAND_MARK_PATTERN })}</svg>`;
}

async function screenshotOf({ browser, html, size }: { browser: Browser; html: string; size: number }): Promise<Buffer> {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block}</style>${html}`);
  const bytes = await page.screenshot({ omitBackground: true, type: 'png' });
  await page.close();
  return bytes;
}

function pixelSizeOf(icon: SiteIcon): number {
  const { size } = SITE_ICONS[icon];
  if (size === null) throw new Error(`${icon} has no pixel size`);
  return size;
}

function squirclePng({ browser, size }: { browser: Browser; size: number }): Promise<Buffer> {
  return screenshotOf({ browser, html: squircleSvg({ size }), size });
}

function fullBleedPng({ browser, size }: { browser: Browser; size: number }): Promise<Buffer> {
  return screenshotOf({ browser, html: fullBleedSvg({ size }), size });
}

async function openGraphPng({ browser }: { browser: Browser }): Promise<Buffer> {
  const { width, height } = OPEN_GRAPH_IMAGE;
  const lockup = dataUrlOf({ bytes: readFileSync(join(REPOSITORY_ROOT, BRAND_DIRECTORY, BRAND_LOCKUP_FILE)), mediaType: 'image/png' });
  const shot = dataUrlOf({
    bytes: readFileSync(join(REPOSITORY_ROOT, PUBLIC_DIRECTORY, LANDING_SHOTS[LandingShot.WindowDark].path)),
    mediaType: 'image/png',
  });
  const page = await browser.newPage({ viewport: { width, height } });
  await page.setContent(`<!doctype html><style>
html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden}
img{position:absolute;display:block}
#lockup{left:${OPEN_GRAPH_LOCKUP.left}px;top:${OPEN_GRAPH_LOCKUP.top}px;width:${OPEN_GRAPH_LOCKUP.width}px;height:${OPEN_GRAPH_LOCKUP.height}px}
#shot{left:${OPEN_GRAPH_SHOT.left}px;top:${OPEN_GRAPH_SHOT.top}px;width:${OPEN_GRAPH_SHOT.width}px;border-radius:20px;box-shadow:${OPEN_GRAPH_SHOT_EDGE}}
</style><img id="lockup" src="${lockup}"><img id="shot" src="${shot}">`);
  await page.evaluate(() => {
    const lockup = document.getElementById('lockup') as HTMLImageElement;
    const canvas = document.createElement('canvas');
    canvas.width = lockup.naturalWidth;
    canvas.height = lockup.naturalHeight;
    const context = canvas.getContext('2d') as CanvasRenderingContext2D;
    context.drawImage(lockup, 0, 0);
    const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
    document.documentElement.style.background = `rgb(${red} ${green} ${blue})`;
  });
  const bytes = await page.screenshot({ type: 'png' });
  await page.close();
  return bytes;
}

async function webpBytesOf({ browser, source, width }: { browser: Browser; source: Buffer; width: number }): Promise<Buffer> {
  const page = await browser.newPage();
  const encoded = await page.evaluate(
    async ({ dataUrl, targetWidth, quality, mediaType }) => {
      const image = new Image();
      image.src = dataUrl;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = Math.round((image.naturalHeight * targetWidth) / image.naturalWidth);
      const context = canvas.getContext('2d') as CanvasRenderingContext2D;
      context.imageSmoothingQuality = 'high';
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mediaType, quality));
      if (blob === null) throw new Error(`the browser cannot encode ${mediaType}`);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      return bytes.reduce((text, byte) => text + String.fromCharCode(byte), '');
    },
    {
      dataUrl: dataUrlOf({ bytes: source, mediaType: 'image/png' }),
      targetWidth: width,
      quality: WEBP_QUALITY,
      mediaType: WEBP_MEDIA_TYPE,
    },
  );
  await page.close();
  return Buffer.from(encoded, 'binary');
}

const ICON_RENDERERS: Record<SiteIcon, (browser: Browser) => Promise<Buffer | string>> = {
  [SiteIcon.Favicon]: async (browser) => icoBytes(await Promise.all(FAVICON_SIZES.map((size) => squirclePng({ browser, size })))),
  [SiteIcon.Vector]: async () => vectorIconSvg(),
  [SiteIcon.AppleTouch]: (browser) => fullBleedPng({ browser, size: pixelSizeOf(SiteIcon.AppleTouch) }),
  [SiteIcon.Icon192]: (browser) => squirclePng({ browser, size: pixelSizeOf(SiteIcon.Icon192) }),
  [SiteIcon.Icon512]: (browser) => squirclePng({ browser, size: pixelSizeOf(SiteIcon.Icon512) }),
  [SiteIcon.Maskable192]: (browser) => fullBleedPng({ browser, size: pixelSizeOf(SiteIcon.Maskable192) }),
  [SiteIcon.Maskable512]: (browser) => fullBleedPng({ browser, size: pixelSizeOf(SiteIcon.Maskable512) }),
};

function writePublic({ path, contents }: { path: string; contents: Buffer | string }): void {
  const target = join(REPOSITORY_ROOT, PUBLIC_DIRECTORY, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents);
}

async function renderIcons({ browser }: { browser: Browser }): Promise<void> {
  await Promise.all(
    Object.values(SiteIcon).map(async (icon) =>
      writePublic({ path: SITE_ICONS[icon].path, contents: await ICON_RENDERERS[icon](browser) }),
    ),
  );
}

async function renderOpenGraph({ browser }: { browser: Browser }): Promise<void> {
  writePublic({ path: OPEN_GRAPH_IMAGE.path, contents: await openGraphPng({ browser }) });
}

async function renderWebpCopies({ browser }: { browser: Browser }): Promise<void> {
  const copies = Object.values(LANDING_SHOTS).flatMap(({ path, webp }) => webp.map((copy) => ({ source: path, ...copy })));
  await Promise.all(
    copies.map(async ({ source, path, width }) => {
      const bytes = await webpBytesOf({ browser, source: readFileSync(join(REPOSITORY_ROOT, PUBLIC_DIRECTORY, source)), width });
      writePublic({ path, contents: bytes });
    }),
  );
}

function writeLock(): void {
  const inputs = hashesOf({ root: REPOSITORY_ROOT });
  writeFileSync(join(REPOSITORY_ROOT, LOCK_PATH), `${JSON.stringify({ inputs }, null, 2)}\n`);
}

export async function renderSiteAssets(): Promise<void> {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  try {
    await Promise.all([renderIcons({ browser }), renderOpenGraph({ browser }), renderWebpCopies({ browser })]);
  } finally {
    await browser.close();
  }
  writeLock();
}
