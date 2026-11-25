import { type ConsoleMessage, type Locator, type Page, expect, test } from '@playwright/test';
import { LANDING_SHOTS, LandingShot } from '../src/site/landing-shots';
import { ProjectName } from './project-name';
import {
  JAVASCRIPT_CONTENT_TYPE,
  SLOW_TURNSTILE_STUB,
  TURNSTILE_DUMMY_TOKEN,
  TURNSTILE_RESPONSE_FIELD,
  TURNSTILE_SCRIPT_URL,
  TURNSTILE_STUB,
} from './turnstile-stub';

enum SitePath {
  Landing = '/',
  Join = '/join',
  SelfHost = '/self-host',
}

enum ColorScheme {
  Light = 'light',
  Dark = 'dark',
}

enum Fragment {
  Hero = 'join',
  Final = 'final',
}

enum Css {
  None = 'none',
  ZeroSeconds = '0s',
}

const JOINED_NOTICE = "You're on the list. Check your inbox.";
const SLOW_SCRIPT_DELAY_MS = 1_500;
const DOCS_SELF_HOST_URL = 'https://docs.todz.app/self-host';
const MOVED_PERMANENTLY_STATUS = 301;
const HEADER_GUIDE_LINK = '.site-header .nav-link';
const FOOTER_GUIDE_LINK = '.site-footer .footer-link';
const MAXIMUM_DARK_CHANNEL = 40;
const SUBPIXEL_TOLERANCE = 0.5;
const KEYBOARD_ORDER = ['.skip-link', '.site-header .brand', '.site-header .nav-link', '#join-email', '#join .join-button'];
const CREDIT_LINK = '.site-footer .footer-credit-link';
const CREDIT_TEXT = 'todz is a product of Logic Bit, made in Brazil';
const CREDIT_WEBSITE = 'https://logicbit.com.br';
const SCRIPT_OWNED_TRANSITION_PROPERTIES = ['color', 'background-color', 'opacity'];
const JOIN_FORMS = [Fragment.Hero, Fragment.Final];
const SITE_PAGES = [SitePath.Landing, SitePath.Join];

test.beforeEach(async ({ page }) => {
  await page.route(TURNSTILE_SCRIPT_URL, (route) => route.fulfill({ contentType: JAVASCRIPT_CONTENT_TYPE, body: TURNSTILE_STUB }));
});

function uniqueAddress(): string {
  const { project, testId } = test.info();
  return `maria.${project.name}.${testId}@example.com`;
}

function isForeignRequest({ url, baseURL }: { url: string; baseURL: string | undefined }): boolean {
  const isOwnOrigin = new URL(url).origin === baseURL;
  return !isOwnOrigin && url !== TURNSTILE_SCRIPT_URL;
}

function isMainFrameMessage({ message, baseURL }: { message: ConsoleMessage; baseURL: string | undefined }): boolean {
  const { url } = message.location();
  const isOwnOrigin = url.length === 0 || new URL(url).origin === baseURL;
  return isOwnOrigin || url === TURNSTILE_SCRIPT_URL;
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

async function expectJoined({ page, form, address }: { page: Page; form: Fragment; address: string }): Promise<void> {
  await expect(page).toHaveURL(new RegExp(`${SitePath.Join}#${form}$`));
  const notice = page.locator(`#${form}-notice`);
  await expect(notice).toHaveText(JOINED_NOTICE);
  await expect(notice).toBeFocused();
  expect(await page.content()).not.toContain(address);
  const inputValues = await page
    .locator('input[name="email"]')
    .evaluateAll((inputs: HTMLInputElement[]) => inputs.map((input) => input.value));
  expect(inputValues).toEqual(['', '']);
}

function onlyOn(projectName: ProjectName): void {
  test.skip(test.info().project.name !== projectName, `runs on ${projectName} only`);
}

function darkestChannelLimitHolds(color: string): boolean {
  const channels = color.match(/\d+/g);
  if (channels === null) throw new Error(`not an rgb color: ${color}`);
  return channels.slice(0, 3).every((channel) => Number(channel) < MAXIMUM_DARK_CHANNEL);
}

async function submitForm({ page, form, address }: { page: Page; form: Fragment; address: string }): Promise<void> {
  const formLocator = page.locator(`form#${form}`);
  await formLocator.locator('input[name="email"]').fill(address);
  await formLocator.locator('button[type="submit"]').click();
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
  test('shows the logo, the promise, the hero shot and the form above the fold at 1280', async ({ page }) => {
    onlyOn(ProjectName.Desktop);
    await page.goto(SitePath.Landing);
    await expect(page.locator('.site-header .brand')).toBeInViewport();
    await expect(page.getByRole('heading', { level: 1 })).toBeInViewport();
    await expect(page.locator('.shot-window img')).toBeInViewport();
    await expect(page.locator('form#join')).toBeInViewport({ ratio: 1 });
  });

  test('loads the light window shot in the light scheme', async ({ page }) => {
    await page.goto(SitePath.Landing);
    const windowImage = page.locator('.shot-window img');
    await expect(windowImage).toHaveJSProperty('complete', true);
    expect(await windowImage.evaluate((image: HTMLImageElement) => new URL(image.currentSrc).pathname)).toBe(
      LANDING_SHOTS[LandingShot.Window].path,
    );
  });
});

test.describe('narrow screen', () => {
  test('has no horizontal scroll, reaches the form and fits every visible hero shot at 375', async ({ page }) => {
    onlyOn(ProjectName.Mobile);
    await page.goto(SitePath.Landing);
    const hasHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(hasHorizontalScroll).toBe(false);
    await page.locator('form#join').scrollIntoViewIfNeeded();
    await expect(page.locator('form#join')).toBeInViewport({ ratio: 1 });
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

  test('applies the dark tokens and loads the dark window shot', async ({ page }) => {
    await page.goto(SitePath.Landing);
    const pageColor = await page.locator('body').evaluate((body) => getComputedStyle(body).backgroundColor);
    expect(darkestChannelLimitHolds(pageColor)).toBe(true);
    const windowImage = page.locator('.shot-window img');
    await expect(windowImage).toHaveJSProperty('complete', true);
    expect(await windowImage.evaluate((image: HTMLImageElement) => new URL(image.currentSrc).pathname)).toBe(
      LANDING_SHOTS[LandingShot.WindowDark].path,
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

test.describe('join', () => {
  test('each form carries the token the Turnstile widget writes', async ({ page }) => {
    await page.goto(SitePath.Landing);
    const tokens = JOIN_FORMS.map((form) => page.locator(`form#${form} input[name="${TURNSTILE_RESPONSE_FIELD}"]`));
    await Promise.all(tokens.map((token) => expect(token).toHaveValue(TURNSTILE_DUMMY_TOKEN)));
  });

  JOIN_FORMS.forEach((form) => {
    test(`the ${form} form answers "${JOINED_NOTICE}" focused on ${SitePath.Join}#${form} without echoing the address`, async ({
      page,
    }) => {
      const address = uniqueAddress();
      await page.goto(SitePath.Landing);
      await submitForm({ page, form, address });
      await expectJoined({ page, form, address });
    });
  });

  test('a second join of the same address from the final form answers the same', async ({ page }) => {
    const address = uniqueAddress();
    await page.goto(SitePath.Landing);
    await submitForm({ page, form: Fragment.Hero, address });
    await expectJoined({ page, form: Fragment.Hero, address });
    await submitForm({ page, form: Fragment.Final, address });
    await expectJoined({ page, form: Fragment.Final, address });
  });

  test.describe('when the Turnstile script loads after the visitor submits', () => {
    test.beforeEach(async ({ page }) => {
      await page.route(TURNSTILE_SCRIPT_URL, async (route) => {
        await new Promise((resolve) => setTimeout(resolve, SLOW_SCRIPT_DELAY_MS));
        await route.fulfill({ contentType: JAVASCRIPT_CONTENT_TYPE, body: SLOW_TURNSTILE_STUB });
      });
    });

    test('a join submitted before the page loads waits for the token and answers the same', async ({ page }) => {
      const address = uniqueAddress();
      await page.goto(SitePath.Landing, { waitUntil: 'domcontentloaded' });
      await submitForm({ page, form: Fragment.Hero, address });
      await expectJoined({ page, form: Fragment.Hero, address });
    });
  });

  test.describe('when the widget writes its token late', () => {
    test.beforeEach(async ({ page }) => {
      await page.route(TURNSTILE_SCRIPT_URL, (route) => route.fulfill({ contentType: JAVASCRIPT_CONTENT_TYPE, body: SLOW_TURNSTILE_STUB }));
    });

    test('a join submitted at once waits for the token and answers the same', async ({ page }) => {
      const address = uniqueAddress();
      await page.goto(SitePath.Landing);
      await submitForm({ page, form: Fragment.Hero, address });
      await expectJoined({ page, form: Fragment.Hero, address });
    });

    test('a second click while the token is pending posts the form once', async ({ page }) => {
      const posts: string[] = [];
      page.on('request', (request) => request.method() === 'POST' && posts.push(request.url()));
      const address = uniqueAddress();
      const button = page.locator(`form#${Fragment.Hero} button[type="submit"]`);
      await page.goto(SitePath.Landing);
      await submitForm({ page, form: Fragment.Hero, address });
      await button.click({ force: true });
      await expectJoined({ page, form: Fragment.Hero, address });
      expect(posts).toHaveLength(1);
    });
  });

  test('a direct GET of /join lands on the landing page', async ({ page }) => {
    await page.goto(SitePath.Join);
    await expect(page).toHaveURL(new RegExp(`${SitePath.Landing}$`));
    await expect(page.locator('.join-notice')).toHaveCount(0);
  });
});

test.describe('self-host guide', () => {
  test('the header and footer links open the guide on the docs', async ({ page }) => {
    await page.goto(SitePath.Landing);
    await expect(page.locator(HEADER_GUIDE_LINK)).toHaveAttribute('href', DOCS_SELF_HOST_URL);
    await expect(page.locator(FOOTER_GUIDE_LINK)).toHaveAttribute('href', DOCS_SELF_HOST_URL);
  });

  test(`${SitePath.SelfHost} answers 301 to the guide on the docs`, async ({ request }) => {
    const response = await request.get(SitePath.SelfHost, { maxRedirects: 0 });
    expect(response.status()).toBe(MOVED_PERMANENTLY_STATUS);
    expect(response.headers().location).toBe(DOCS_SELF_HOST_URL);
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
  test('tabs through the skip link, logo, guide link, email and join button with a visible focus ring', async ({ page }) => {
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
  test('shift-tab from the guide link reaches the credit link with a visible focus ring', async ({ page }) => {
    await page.goto(SitePath.Landing);
    await page.locator(FOOTER_GUIDE_LINK).focus();
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator(CREDIT_LINK)).toBeFocused();
    expect(await hasFocusRing(page.locator(CREDIT_LINK))).toBe(true);
  });
});

test.describe('console and network', () => {
  SITE_PAGES.forEach((sitePath) => {
    test(`${sitePath} logs no error and calls only its own origin and the Turnstile script`, async ({ page, baseURL }) => {
      const { errors, foreignRequests } = watchConsoleAndNetwork({ page, baseURL });
      await page.goto(sitePath);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForLoadState('networkidle');
      expect({ errors, foreignRequests }).toEqual({ errors: [], foreignRequests: [] });
    });
  });

  test('the join answer logs no error and calls only its own origin and the Turnstile script', async ({ page, baseURL }) => {
    const { errors, foreignRequests } = watchConsoleAndNetwork({ page, baseURL });
    await page.goto(SitePath.Landing);
    await submitForm({ page, form: Fragment.Hero, address: uniqueAddress() });
    await expect(page.locator(`#${Fragment.Hero}-notice`)).toBeVisible();
    expect({ errors, foreignRequests }).toEqual({ errors: [], foreignRequests: [] });
  });
});
