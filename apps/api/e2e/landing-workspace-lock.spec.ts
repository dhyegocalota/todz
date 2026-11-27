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
const VIEWPORT_SIZES = {
  [Viewport.Desktop]: { width: 1280, height: 800 },
  [Viewport.Phone]: { width: 390, height: 844 },
};
const { lock } = LANDING_COPY.benefits;
const LOCK_CARD = '.benefit-card:has(.lock-glyph)';

function onlyOn(projectName: ProjectName): void {
  test.skip(test.info().project.name !== projectName, `runs on ${projectName} only`);
}

async function hasSidewaysScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
}

([ColorScheme.Light, ColorScheme.Dark] as const).forEach((colorScheme) => {
  (Object.values(Viewport) as Viewport[]).forEach((viewport) => {
    test.describe(`the workspace lock card at ${viewport}, ${colorScheme}`, () => {
      test.use({ colorScheme, viewport: VIEWPORT_SIZES[viewport] });

      test('shows the headline, the body, the shot and the glyph with no sideways scroll', async ({ page }) => {
        onlyOn(ProjectName.Desktop);
        await page.goto(LANDING_PATH);
        const card = page.locator(LOCK_CARD);
        await card.scrollIntoViewIfNeeded();
        await expect(card.getByRole('heading', { level: 3, name: lock.title })).toBeVisible();
        await expect(card.getByText(lock.body)).toBeVisible();
        await expect(card.locator('img')).toBeVisible();
        await expect(card.locator('.lock-glyph')).toBeVisible();
        expect(await hasSidewaysScroll(page)).toBe(false);
      });
    });
  });
});

test.describe('the workspace lock card at 320 px', () => {
  test.use({ viewport: { width: 320, height: 700 } });

  test('has no sideways scroll at the narrowest supported width', async ({ page }) => {
    onlyOn(ProjectName.Mobile);
    await page.goto(LANDING_PATH);
    await page.locator(LOCK_CARD).scrollIntoViewIfNeeded();
    expect(await hasSidewaysScroll(page)).toBe(false);
  });
});

test.describe('the workspace lock card with reduced motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });

  test('is shown at once', async ({ page }) => {
    onlyOn(ProjectName.Desktop);
    await page.goto(LANDING_PATH);
    const card = page.locator(LOCK_CARD);
    await card.scrollIntoViewIfNeeded();
    await expect(card).toHaveCSS('opacity', '1');
  });
});
