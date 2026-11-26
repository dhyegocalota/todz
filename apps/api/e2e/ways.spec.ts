import { expect, test } from '@playwright/test';
import { LANDING_COPY } from '../src/site/landing-copy';
import { ProjectName } from './project-name';

const SELF_HOST_URL = 'https://docs.todz.app/self-host';
const COLUMN_TOLERANCE = 1;

test.describe('the two ways section', () => {
  ['light', 'dark'].forEach((colorScheme) => {
    test(`shows the wider cloud card beside the self-host card, the badges, the buttons and the note in ${colorScheme}`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: colorScheme === 'dark' ? 'dark' : 'light' });
      await page.goto('/');
      await expect(page.locator('#ways')).toBeVisible();
      const cards = page.locator('.way-card');
      await expect(cards).toHaveCount(2);
      await expect(cards.nth(0).locator('.way-badge')).toHaveText(LANDING_COPY.ways.cloud.badge);
      await expect(cards.nth(1).locator('.way-badge')).toHaveText(LANDING_COPY.ways.selfHost.badge);
      await expect(cards.nth(0).getByRole('link', { name: LANDING_COPY.ways.cloud.cta })).toHaveAttribute('href', '/download');
      await expect(cards.nth(1).getByRole('link', { name: LANDING_COPY.ways.selfHost.cta })).toHaveAttribute('href', SELF_HOST_URL);
      await expect(page.locator('.ways-note')).toHaveText(LANDING_COPY.ways.note);
      const [first, second] = await Promise.all([cards.nth(0).boundingBox(), cards.nth(1).boundingBox()]);
      if (first === null || second === null) throw new Error('both cards are laid out');
      const isDesktop = test.info().project.name === ProjectName.Desktop;
      if (isDesktop) expect(first.width).toBeGreaterThan(second.width);
      if (!isDesktop) expect(Math.abs(first.width - second.width)).toBeLessThanOrEqual(COLUMN_TOLERANCE);
    });
  });

  test('sits side by side on desktop and stacked on a phone, with no sideways scroll', async ({ page }) => {
    await page.goto('/');
    const [first, second] = await Promise.all([
      page.locator('.way-card').nth(0).boundingBox(),
      page.locator('.way-card').nth(1).boundingBox(),
    ]);
    if (first === null || second === null) throw new Error('both cards are laid out');
    const isDesktop = test.info().project.name === ProjectName.Desktop;
    if (isDesktop) expect(Math.abs(first.y - second.y)).toBeLessThanOrEqual(COLUMN_TOLERANCE);
    if (!isDesktop) expect(second.y).toBeGreaterThan(first.y + first.height - COLUMN_TOLERANCE);
    const hasSidewaysScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(hasSidewaysScroll).toBe(false);
  });

  test('the hero keeps its free line and chip', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.hero-free')).toHaveText(LANDING_COPY.free.line);
    await expect(page.locator('.hero-free a')).toHaveAttribute('href', '#ways');
    await expect(page.locator('.hero .download-button')).toHaveText(LANDING_COPY.download.heroButton);
    await expect(page.locator('.free-chip')).toHaveCount(0);
  });
});
