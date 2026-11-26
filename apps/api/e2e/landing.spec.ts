import { type ConsoleMessage, type Locator, type Page, expect, test } from '@playwright/test';
import { LANDING_COPY } from '../src/site/landing-copy';
import { LANDING_SHOTS, LandingShot } from '../src/site/landing-shots';
import { ProjectName } from './project-name';

enum SitePath {
  Landing = '/',
  Join = '/join',
  SelfHost = '/self-host',
}

enum ColorScheme {
  Light = 'light',
  Dark = 'dark',
}

const BRAND_ASSET_PATH = '/brand/todz-lockup.png';
const OK_STATUS = 200;
const NOT_FOUND_STATUS = 404;
const STRICT_TRANSPORT_SECURITY = 'max-age=31536000; includeSubDomains';
const DOCS_SELF_HOST_URL = 'https://docs.todz.app/self-host';
const MOVED_PERMANENTLY_STATUS = 301;
const DOCS_REDIRECT_CACHE_CONTROL = 'max-age=3600';
const DOCS_INSTALL_URL = 'https://docs.todz.app/install-on-mac';
const HEADER_GUIDE_LINK = `.site-header .nav-link[href="${DOCS_SELF_HOST_URL}"]`;
const FOOTER_GUIDE_LINK = `.site-footer .footer-link[href="${DOCS_SELF_HOST_URL}"]`;
const HEADER_INSTALL_LINK = `.site-header .nav-link[href="${DOCS_INSTALL_URL}"]`;
const FOOTER_INSTALL_LINK = `.site-footer .footer-link[href="${DOCS_INSTALL_URL}"]`;
const MAXIMUM_DARK_CHANNEL = 40;
const SUBPIXEL_TOLERANCE = 0.5;
const MAXIMUM_PHONE_FOOTER_HEIGHT = 160;
const MAXIMUM_BLANK_WIDGET_BAND = 48;
const BLANK_PIXEL_FLOOR = 200;
const WIDGET_SIDE_MARGIN = 100;
const KEYBOARD_ORDER = [
  '.skip-link',
  '.site-header .brand',
  HEADER_GUIDE_LINK,
  HEADER_INSTALL_LINK,
  '.hero-free-link',
  '.hero .download-button',
];
const CREDIT_LINK = '.site-footer .footer-credit-link';
const CREDIT_TEXT = '© todz · todz is a product of Logic Bit, made in Brazil';
const CREDIT_WEBSITE = 'https://logicbit.com.br';
const SCRIPT_OWNED_TRANSITION_PROPERTIES = ['color', 'background-color', 'opacity'];
const SITE_PAGES = [SitePath.Landing];

function webpPathsOf(shot: LandingShot): string[] {
  return LANDING_SHOTS[shot].webp.map(({ path }) => path);
}

function isForeignRequest({ url, baseURL }: { url: string; baseURL: string | undefined }): boolean {
  const isOwnOrigin = new URL(url).origin === baseURL;
  return !isOwnOrigin;
}

function isMainFrameMessage({ message, baseURL }: { message: ConsoleMessage; baseURL: string | undefined }): boolean {
  const { url } = message.location();
  const isOwnOrigin = url.length === 0 || new URL(url).origin === baseURL;
  return isOwnOrigin;
}

function watchConsoleAndNetwork({ page, baseURL }: { page: Page; baseURL: string | undefined }): {
  errors: string[];
  foreignRequests: string[];
} {
  const errors: string[] = [];
  const foreignRequests: string[] = [];
  page.on('console', (message) => message.type() === 'error' && isMainFrameMessage({ message, baseURL }) && errors.push(message.text()));
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => isForeignRequest({ url: request.url(), baseURL }) && foreignRequests.push(request.url()));
  return { errors, foreignRequests };
}

function onlyOn(projectName: ProjectName): void {
  test.skip(test.info().project.name !== projectName, `runs on ${projectName} only`);
}

function darkestChannelLimitHolds(color: string): boolean {
  const channels = color.match(/\d+/g);
  if (channels === null) throw new Error(`not an rgb color: ${color}`);
  return channels.slice(0, 3).every((channel) => Number(channel) < MAXIMUM_DARK_CHANNEL);
}

async function scrolledImages(page: Page): Promise<Locator[]> {
  const images = page.locator('img');
  const imageCount = await images.count();
  return Array.from({ length: imageCount }, (_, index) => images.nth(index));
}

async function hasFocusRing(element: Locator): Promise<boolean> {
  return element.evaluate((node) => {
    const ownOutline = getComputedStyle(node).outlineStyle;
    if (ownOutline !== 'none') return true;
    const capsule = node.closest('.join-capsule');
    return capsule !== null && getComputedStyle(capsule).outlineStyle !== 'none';
  });
}

test.describe('first fold', () => {
  test('shows the logo, the promise, the hero shot and the download above the fold at 1280', async ({ page }) => {
    onlyOn(ProjectName.Desktop);
    await page.goto(SitePath.Landing);
    await expect(page.locator('.site-header .brand')).toBeInViewport();
    await expect(page.getByRole('heading', { level: 1 })).toBeInViewport();
    await expect(page.locator('.shot-window img')).toBeInViewport();
    await expect(page.locator('.hero .download-button')).toBeInViewport({ ratio: 1 });
  });

  test('loads the light window shot in the light scheme', async ({ page }) => {
    onlyOn(ProjectName.Desktop);
    await page.goto(SitePath.Landing);
    const windowImage = page.locator('.shot-window img');
    await expect(windowImage).toHaveJSProperty('complete', true);
    expect(webpPathsOf(LandingShot.Window)).toContain(
      await windowImage.evaluate((image: HTMLImageElement) => new URL(image.currentSrc).pathname),
    );
  });
});

test.describe('narrow screen', () => {
  test('has no horizontal scroll, reaches the download and fits every visible hero shot at 375', async ({ page }) => {
    onlyOn(ProjectName.Mobile);
    await page.goto(SitePath.Landing);
    const hasHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(hasHorizontalScroll).toBe(false);
    await expect(page.locator('.hero .download-button')).toBeInViewport({ ratio: 1 });
    const shotsOverflowing = await page.locator('.desk-stage img').evaluateAll(
      (images, tolerance) =>
        images
          .map((image) => image.getBoundingClientRect())
          .filter((box) => box.width > 0)
          .filter((box) => box.left < -tolerance || box.right > window.innerWidth + tolerance),
      SUBPIXEL_TOLERANCE,
    );
    expect(shotsOverflowing).toEqual([]);
  });

  test('keeps the footer compact on a phone with every link and the credit line', async ({ page }) => {
    onlyOn(ProjectName.Mobile);
    await page.goto(SitePath.Landing);
    const footer = page.locator('.site-footer');
    const footerBox = await footer.boundingBox();
    expect(footerBox?.height).toBeLessThanOrEqual(MAXIMUM_PHONE_FOOTER_HEIGHT);
    await expect(footer.locator('.footer-link')).toHaveCount(4);
    await expect(footer.locator('.star-pill')).toBeVisible();
    await expect(footer.locator('.footer-credit')).toHaveText(CREDIT_TEXT);
  });
});

test.describe('hero widget frame', () => {
  test('leaves no blank band below the last row of the widget shot', async ({ page }) => {
    await page.goto(SitePath.Landing);
    const { path, crop } = LANDING_SHOTS[LandingShot.WidgetMedium];
    if (crop === null) throw new Error('the widget shot has no crop');
    const blankBand = await page.evaluate(
      async ({ path: shotPath, crop: box, margin, blankFloor }) => {
        const image = new Image();
        image.src = shotPath;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d');
        if (context === null) throw new Error('no canvas context');
        context.drawImage(image, 0, 0);
        const rows = Array.from({ length: box.height }, (_, offset) => box.y + offset);
        const inkRows = rows.filter((row) => {
          const { data } = context.getImageData(box.x + margin, row, box.width - 2 * margin, 1);
          return Array.from(data).some((channel, index) => index % 4 !== 3 && channel < blankFloor);
        });
        return box.y + box.height - (Math.max(...inkRows) + 1);
      },
      { path, crop, margin: WIDGET_SIDE_MARGIN, blankFloor: BLANK_PIXEL_FLOOR },
    );
    expect(blankBand).toBeLessThanOrEqual(MAXIMUM_BLANK_WIDGET_BAND);
  });
});

test.describe('images', () => {
  test('every visible image loads once scrolled into view', async ({ page }) => {
    await page.goto(SitePath.Landing);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const images = await scrolledImages(page);
    const blankImages = await images.reduce<Promise<string[]>>(async (blankSoFar, image) => {
      const blank = await blankSoFar;
      const isVisible = await image.evaluate((node) => node.getBoundingClientRect().width > 0);
      if (!isVisible) return blank;
      await image.scrollIntoViewIfNeeded();
      const hasLoaded = await expect
        .poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth > 0))
        .toBe(true)
        .then(
          () => true,
          () => false,
        );
      if (hasLoaded) return blank;
      return [...blank, await image.evaluate((node: HTMLImageElement) => node.currentSrc)];
    }, Promise.resolve([]));
    expect(blankImages).toEqual([]);
  });
});

test.describe('dark scheme', () => {
  test.use({ colorScheme: ColorScheme.Dark });

  test('applies the dark tokens', async ({ page }) => {
    await page.goto(SitePath.Landing);
    const pageColor = await page.locator('body').evaluate((body) => getComputedStyle(body).backgroundColor);
    expect(darkestChannelLimitHolds(pageColor)).toBe(true);
  });

  test('loads the dark window shot', async ({ page }) => {
    onlyOn(ProjectName.Desktop);
    await page.goto(SitePath.Landing);
    const windowImage = page.locator('.shot-window img');
    await expect(windowImage).toHaveJSProperty('complete', true);
    expect(webpPathsOf(LandingShot.WindowDark)).toContain(
      await windowImage.evaluate((image: HTMLImageElement) => new URL(image.currentSrc).pathname),
    );
  });
});

test.describe('reduced motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });

  test('animates nothing and transitions only colour and opacity', async ({ page }) => {
    await page.goto(SitePath.Landing);
    const motion = await page.evaluate((allowedTransitionProperties) => {
      const elements = Array.from(document.querySelectorAll('*'));
      const styles = elements.map((element) => getComputedStyle(element));
      return {
        runningAnimations: document.getAnimations().length,
        animated: styles.filter((style) => style.animationName !== 'none' && style.animationDuration !== '0s').length,
        transitioningOtherProperties: styles
          .flatMap((style) => (style.transitionDuration === '0s' ? [] : style.transitionProperty.split(', ')))
          .filter((property) => !allowedTransitionProperties.includes(property)),
      };
    }, SCRIPT_OWNED_TRANSITION_PROPERTIES);
    expect(motion).toEqual({ runningAnimations: 0, animated: 0, transitioningOtherProperties: [] });
  });
});

test.describe('the join path is gone', () => {
  test('the landing has no form and the join path answers 404 to a post and to a get', async ({ page, request }) => {
    await page.goto(SitePath.Landing);
    await expect(page.locator('form')).toHaveCount(0);
    const posted = await request.post(SitePath.Join, { form: { email: 'maria@example.com' } });
    expect(posted.status()).toBe(NOT_FOUND_STATUS);
    const fetched = await request.get(SitePath.Join);
    expect(fetched.status()).toBe(NOT_FOUND_STATUS);
  });
});

test.describe('static assets', () => {
  test('a static asset answers with strict transport security, nosniff and no referrer', async ({ request }) => {
    const response = await request.get(BRAND_ASSET_PATH);
    expect(response.status()).toBe(OK_STATUS);
    expect(response.headers()).toMatchObject({
      'strict-transport-security': STRICT_TRANSPORT_SECURITY,
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
    });
  });
});

test.describe('self-host guide', () => {
  test('the header and footer links open the guide on the docs', async ({ page }) => {
    await page.goto(SitePath.Landing);
    await expect(page.locator(HEADER_GUIDE_LINK)).toHaveAttribute('href', DOCS_SELF_HOST_URL);
    await expect(page.locator(FOOTER_GUIDE_LINK)).toHaveAttribute('href', DOCS_SELF_HOST_URL);
  });

  test('the header and footer links open the Mac install page on the docs', async ({ page }) => {
    await page.goto(SitePath.Landing);
    await expect(page.locator(HEADER_INSTALL_LINK)).toBeVisible();
    await expect(page.locator(FOOTER_INSTALL_LINK)).toBeVisible();
  });

  test('the narrow header shows the short install label', async ({ page }) => {
    onlyOn(ProjectName.Mobile);
    await page.goto(SitePath.Landing);
    await expect(page.locator(`${HEADER_INSTALL_LINK} .label-short`)).toHaveText('Install');
    await expect(page.locator(`${HEADER_INSTALL_LINK} .label-short`)).toBeVisible();
    await expect(page.locator(`${HEADER_INSTALL_LINK} .label-long`)).toBeHidden();
  });

  test(`${SitePath.SelfHost} answers 301 to the guide on the docs`, async ({ request }) => {
    const response = await request.get(SitePath.SelfHost, { maxRedirects: 0 });
    expect(response.status()).toBe(MOVED_PERMANENTLY_STATUS);
    expect(response.headers().location).toBe(DOCS_SELF_HOST_URL);
    expect(response.headers()['cache-control']).toBe(DOCS_REDIRECT_CACHE_CONTROL);
  });
});

test.describe('credit', () => {
  test(`${SitePath.Landing} credits Logic Bit in the footer with a link to its website`, async ({ page }) => {
    await page.goto(SitePath.Landing);
    await expect(page.locator('.site-footer .footer-credit')).toHaveText(CREDIT_TEXT);
    await expect(page.locator(CREDIT_LINK)).toHaveAttribute('href', CREDIT_WEBSITE);
    await expect(page.locator(CREDIT_LINK)).toBeVisible();
  });
});

test.describe('keyboard', () => {
  test('tabs through the skip link, logo, guide link, install link and download button with a visible focus ring', async ({ page }) => {
    await page.goto(SitePath.Landing);
    const focusRings = await KEYBOARD_ORDER.reduce<Promise<boolean[]>>(async (ringsSoFar, selector) => {
      const rings = await ringsSoFar;
      await page.keyboard.press('Tab');
      const element = page.locator(selector);
      await expect(element).toBeFocused();
      return [...rings, await hasFocusRing(element)];
    }, Promise.resolve([]));
    expect(focusRings).toEqual(KEYBOARD_ORDER.map(() => true));
  });
});

test.describe('keyboard in the footer', () => {
  test('shift-tab from the footer star pill reaches the credit link with a visible focus ring', async ({ page }) => {
    await page.goto(SitePath.Landing);
    await page.locator('.site-footer .star-pill').focus();
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator(CREDIT_LINK)).toBeFocused();
    expect(await hasFocusRing(page.locator(CREDIT_LINK))).toBe(true);
  });
});

test.describe('console and network', () => {
  SITE_PAGES.forEach((sitePath) => {
    test(`${sitePath} logs no error and calls only its own origin`, async ({ page, baseURL }) => {
      const { errors, foreignRequests } = watchConsoleAndNetwork({ page, baseURL });
      await page.goto(sitePath);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForLoadState('networkidle');
      expect({ errors, foreignRequests }).toEqual({ errors: [], foreignRequests: [] });
    });
  });
});
