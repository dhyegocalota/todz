import { type Page, expect, test } from '@playwright/test';
import { LANDING_COPY } from '../src/site/landing-copy';
import { ProjectName } from './project-name';

enum ColorScheme {
  Light = 'light',
  Dark = 'dark',
}

enum Viewport {
  Desktop = 'desktop 1280',
  Phone = 'phone 390',
}

const LANDING_PATH = '/';
const STAGED_LANDING_URL = 'http://localhost:8792/';
const VIEWPORT_SIZES = {
  [Viewport.Desktop]: { width: 1280, height: 800 },
  [Viewport.Phone]: { width: 390, height: 844 },
};
const { day } = LANDING_COPY.benefits;
const DAY_CARD = '.benefit-card-day';
const DAY_CARD_ID = 'proactive-day';
const STOP_TIMES = ['07:00', '09:00', '10:30', '18:00'];
const FIRST_STOP = '.day-stop:first-child';
const FILL_PSEUDO_ELEMENT = '::after';
const NO_TRANSFORM = 'none';
const MATRIX_PATTERN = /^matrix\(([^)]+)\)$/;
const HORIZONTAL_SCALE_INDEX = 0;
const FULL_SCALE = 1;
const SCROLL_SETTLE_PROGRESS = 0.5;
const SUBPIXEL_TOLERANCE = 1;

function onlyOn(projectName: ProjectName): void {
  test.skip(test.info().project.name !== projectName, `runs on ${projectName} only`);
}

async function expectDayCardShown(page: Page): Promise<void> {
  const card = page.locator(`.benefits ${DAY_CARD}`);
  await card.scrollIntoViewIfNeeded();
  await expect(card.getByRole('heading', { level: 3, name: day.title })).toBeVisible();
  await Promise.all(STOP_TIMES.map((time) => expect(card.locator(`time[datetime="${time}"]`)).toBeVisible()));
  await Promise.all(
    [day.extras.ribbon, day.extras.temperature, day.extras.siri].map(({ label }) =>
      expect(card.getByText(label, { exact: true })).toBeVisible(),
    ),
  );
  await expect(card.getByText(day.note)).toBeVisible();
}

async function hasSidewaysScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
}

async function cardBackgroundOf(page: Page): Promise<string> {
  return page.locator(DAY_CARD).evaluate((card) => getComputedStyle(card).backgroundColor + getComputedStyle(card).backgroundImage);
}

function horizontalScaleOf(transform: string): number {
  if (transform === NO_TRANSFORM) return FULL_SCALE;
  const matrix = MATRIX_PATTERN.exec(transform)?.[1];
  if (matrix === undefined) throw new Error(`not a matrix transform: ${transform}`);
  return Number(matrix.split(',')[HORIZONTAL_SCALE_INDEX]);
}

async function fillScaleOf(page: Page): Promise<number> {
  const transform = await page
    .locator(`${DAY_CARD} ${FIRST_STOP}`)
    .evaluate((stop, pseudoElement) => getComputedStyle(stop, pseudoElement).transform, FILL_PSEUDO_ELEMENT);
  return horizontalScaleOf(transform);
}

async function scrollWellTopTo({ page, viewportShare }: { page: Page; viewportShare: number }): Promise<void> {
  await page.locator(`${DAY_CARD} .day-well`).evaluate((well, share) => {
    const wellTop = well.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, wellTop - window.innerHeight * share);
  }, viewportShare);
}

([ColorScheme.Light, ColorScheme.Dark] as const).forEach((colorScheme) => {
  (Object.values(Viewport) as Viewport[]).forEach((viewport) => {
    test.describe(`the proactive day card at ${viewport}, ${colorScheme}`, () => {
      test.use({ colorScheme, viewport: VIEWPORT_SIZES[viewport] });

      test(`E1 E2 E3. shows the line, the four stops, the chips and the note, with no sideways scroll`, async ({ page }) => {
        onlyOn(ProjectName.Desktop);
        await page.goto(LANDING_PATH);
        await expectDayCardShown(page);
        expect(await hasSidewaysScroll(page)).toBe(false);
      });
    });
  });
});

(Object.values(Viewport) as Viewport[]).forEach((viewport) => {
  test.describe(`the proactive day card anchor at ${viewport}`, () => {
    test.use({ viewport: VIEWPORT_SIZES[viewport] });

    test('E8. lands the headline below the sticky header when opened by its anchor', async ({ page }) => {
      onlyOn(ProjectName.Desktop);
      await page.goto(`${LANDING_PATH}#${DAY_CARD_ID}`);
      await expect
        .poll(async () => {
          const headerBox = await page.locator('.site-header').boundingBox();
          const titleBox = await page.locator(`${DAY_CARD} .day-title`).boundingBox();
          return headerBox !== null && titleBox !== null && headerBox.y + headerBox.height <= titleBox.y;
        })
        .toBe(true);
    });
  });
});

test.describe('the proactive day card across the schemes', () => {
  test('E2. paints the card differently in the light and dark schemes', async ({ browser }) => {
    onlyOn(ProjectName.Desktop);
    const backgrounds = await Promise.all(
      [ColorScheme.Light, ColorScheme.Dark].map(async (colorScheme) => {
        const context = await browser.newContext({ colorScheme, viewport: VIEWPORT_SIZES[Viewport.Desktop] });
        const page = await context.newPage();
        await page.goto(LANDING_PATH);
        const background = await cardBackgroundOf(page);
        await context.close();
        return background;
      }),
    );
    expect(new Set(backgrounds).size).toBe(backgrounds.length);
  });
});

test.describe('the proactive day card at 320 px', () => {
  test.use({ viewport: { width: 320, height: 700 } });

  test('E3. has no sideways scroll at the narrowest supported width', async ({ page }) => {
    onlyOn(ProjectName.Mobile);
    await page.goto(LANDING_PATH);
    await expectDayCardShown(page);
    expect(await hasSidewaysScroll(page)).toBe(false);
  });
});

test.describe('the proactive day card with reduced motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' }, viewport: VIEWPORT_SIZES[Viewport.Desktop] });

  test('E4. shows the track complete and the vignettes at rest, with no transform', async ({ page }) => {
    onlyOn(ProjectName.Desktop);
    await page.goto(LANDING_PATH);
    await scrollWellTopTo({ page, viewportShare: 1 });
    expect(await fillScaleOf(page)).toBe(FULL_SCALE);
    const transforms = await page
      .locator(`${DAY_CARD} .day-vignette`)
      .evaluateAll((vignettes) => vignettes.map((vignette) => getComputedStyle(vignette).transform));
    expect(transforms).toEqual(STOP_TIMES.map(() => NO_TRANSFORM));
    const runningDayAnimations = await page.evaluate(() => document.getAnimations().length);
    expect(runningDayAnimations).toBe(0);
  });
});

test.describe('the proactive day card with scroll-linked motion', () => {
  test.use({ viewport: VIEWPORT_SIZES[Viewport.Desktop] });

  test('E5. draws the track as the visitor scrolls', async ({ page, browserName }) => {
    onlyOn(ProjectName.Desktop);
    test.skip(browserName !== 'chromium', 'scroll-linked animation is checked on Chromium');
    await page.goto(LANDING_PATH);
    await scrollWellTopTo({ page, viewportShare: 1 });
    const scaleWhenEntering = await fillScaleOf(page);
    await scrollWellTopTo({ page, viewportShare: SCROLL_SETTLE_PROGRESS });
    await expect.poll(() => fillScaleOf(page)).toBeGreaterThan(scaleWhenEntering);
  });
});

test.describe('the proactive day card and the strict policy', () => {
  test('E6. adds no inline handler, style attribute or script, and no policy violation or console error', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (event) => console.error(`policy violation: ${event.violatedDirective}`));
    });
    await page.goto(LANDING_PATH);
    await page.locator(DAY_CARD).scrollIntoViewIfNeeded();
    await page.waitForLoadState('networkidle');
    await expect(page.locator(`${DAY_CARD} script`)).toHaveCount(0);
    await expect(page.locator(`${DAY_CARD} [style]`)).toHaveCount(0);
    const inlineHandlers = await page.evaluate(
      () =>
        Array.from(document.querySelectorAll('*')).filter((element) => element.getAttributeNames().some((name) => name.startsWith('on')))
          .length,
    );
    expect(inlineHandlers).toBe(0);
    expect(errors).toEqual([]);
  });
});

test.describe('the proactive day card and the keyboard', () => {
  test('E7. adds no focusable element', async ({ page }) => {
    await page.goto(LANDING_PATH);
    const focusableCount = await page
      .locator(`${DAY_CARD} *`)
      .evaluateAll((elements) => elements.filter((element) => (element as HTMLElement).tabIndex >= 0).length);
    expect(focusableCount).toBe(0);
  });
});

test.describe('the proactive day card edge cases', () => {
  test('X1. renders when the star count is unavailable', async ({ page }) => {
    onlyOn(ProjectName.Desktop);
    await page.goto(STAGED_LANDING_URL);
    await expectDayCardShown(page);
  });

  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    test('X2. keeps the card and the note readable', async ({ page }) => {
      onlyOn(ProjectName.Desktop);
      await page.goto(LANDING_PATH);
      await expectDayCardShown(page);
    });
  });

  test('keeps the card inside the page width', async ({ page }) => {
    await page.goto(LANDING_PATH);
    const card = await page.locator(DAY_CARD).boundingBox();
    const viewportWidth = page.viewportSize()?.width;
    if (card === null || viewportWidth === undefined) throw new Error('the card is laid out');
    expect(card.x).toBeGreaterThanOrEqual(-SUBPIXEL_TOLERANCE);
    expect(card.x + card.width).toBeLessThanOrEqual(viewportWidth + SUBPIXEL_TOLERANCE);
  });
});
