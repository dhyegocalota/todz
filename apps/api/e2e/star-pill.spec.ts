import { REPOSITORY } from '@todz/types';
import { type Page, expect, test } from '@playwright/test';
import { LANDING_COPY } from '../src/site/landing-copy';
import { FAKE_GITHUB_STARS_TEXT } from './fake-github';

enum ColorScheme {
  Light = 'light',
  Dark = 'dark',
}

const STAGED_SITE_ORIGIN = 'http://localhost:8792';
const COLOR_SCHEMES = [ColorScheme.Light, ColorScheme.Dark];
const HERO_PILL = '.hero .star-pill';
const FOOTER_PILL = '.site-footer .star-pill';
const FINAL_COUNT = '.hero .star-count-final';
const SAMPLE_WINDOW_MS = 1_200;
const SUBPIXEL_PRECISION = 100;

async function widthsWhileScrollingIn(page: Page): Promise<{ widths: number[]; sawCounting: boolean }> {
  return page.evaluate(
    ([selector, windowMs, precision]) =>
      new Promise<{ widths: number[]; sawCounting: boolean }>((resolve) => {
        const pill = document.querySelector(String(selector));
        const count = document.querySelector('.hero .star-count');
        if (pill === null || count === null) throw new Error('the hero has a pill with a count');
        const widths = new Set<number>();
        const state = { sawCounting: false };
        const sample = () => {
          widths.add(Math.round(pill.getBoundingClientRect().width * Number(precision)));
          state.sawCounting = state.sawCounting || count.hasAttribute('data-counting');
        };
        const started = performance.now();
        const tick = () => {
          sample();
          if (performance.now() - started < Number(windowMs)) return requestAnimationFrame(tick);
          resolve({ widths: [...widths], sawCounting: state.sawCounting });
        };
        pill.scrollIntoView();
        requestAnimationFrame(tick);
      }),
    [HERO_PILL, SAMPLE_WINDOW_MS, SUBPIXEL_PRECISION],
  );
}

test.describe('the star pill with the count known', () => {
  COLOR_SCHEMES.forEach((colorScheme) => {
    test.describe(`in ${colorScheme}`, () => {
      test.use({ colorScheme });

      test('shows the label and the abbreviated count in the hero and the footer, linking the repository', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator(HERO_PILL)).toHaveAttribute('href', REPOSITORY.url);
        await expect(page.locator(HERO_PILL)).toContainText(LANDING_COPY.openSource.starLabel);
        await expect(page.locator(FINAL_COUNT)).toHaveText(FAKE_GITHUB_STARS_TEXT);
        await expect(page.locator(FOOTER_PILL)).toContainText(FAKE_GITHUB_STARS_TEXT);
        await expect(page.locator(FOOTER_PILL)).toHaveAttribute('href', REPOSITORY.url);
      });

      test('keeps one width before, during and after the count-up, so nothing shifts', async ({ page }) => {
        await page.goto('/');
        const { widths, sawCounting } = await widthsWhileScrollingIn(page);
        expect(sawCounting).toBe(true);
        expect(widths).toHaveLength(1);
        await expect(page.locator('.hero .star-count')).not.toHaveAttribute('data-counting', /.*/);
        await expect(page.locator(FINAL_COUNT)).toBeVisible();
      });
    });
  });

  test('has the count in the first paint, before any script runs', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator(FINAL_COUNT)).toHaveText(FAKE_GITHUB_STARS_TEXT);
    await context.close();
  });

  test.describe('with reduced motion', () => {
    test.use({ contextOptions: { reducedMotion: 'reduce' } });

    test('never counts and shows the final number at once', async ({ page }) => {
      await page.goto('/');
      const { sawCounting } = await widthsWhileScrollingIn(page);
      expect(sawCounting).toBe(false);
      await expect(page.locator(FINAL_COUNT)).toHaveText(FAKE_GITHUB_STARS_TEXT);
      await expect(page.locator(FINAL_COUNT)).toBeVisible();
    });
  });

  test('opens no new window and logs no policy violation or console error', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      window.addEventListener('securitypolicyviolation', (event) => console.error(`policy ${event.violatedDirective}`));
    });
    await page.goto('/');
    await widthsWhileScrollingIn(page);
    expect(errors).toEqual([]);
  });

  test('fits a phone without scrolling sideways', async ({ page }) => {
    await page.goto('/');
    const hasSidewaysScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(hasSidewaysScroll).toBe(false);
  });
});

test.describe('the star pill when GitHub cannot be reached', () => {
  test.use({ baseURL: STAGED_SITE_ORIGIN });

  test('shows Star on GitHub and no number, in the hero and the footer', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator(HERO_PILL)).toContainText(LANDING_COPY.openSource.starLabel);
    await expect(page.locator(FOOTER_PILL)).toContainText(LANDING_COPY.openSource.starLabel);
    await expect(page.locator('.star-count')).toHaveCount(0);
    await expect(page.locator('.star-glyph')).toHaveCount(0);
  });
});
