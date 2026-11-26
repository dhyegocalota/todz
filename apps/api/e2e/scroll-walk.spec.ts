import { expect, test } from '@playwright/test';

const SCROLL_STEP_PX = 400;
const SETTLE_MS = 120;
const TOLERANCE_PX = 1;
const OPAQUE_ENOUGH = 0.99;
const SECTIONS = ['.desk-stage', '#ways', '.benefits', '.how-it-works .terminal', '.final-call', '.site-footer'];

async function scrollThroughPage(page: import('@playwright/test').Page): Promise<void> {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const steps = Array.from({ length: Math.ceil(height / SCROLL_STEP_PX) }, (_, index) => index);
  await steps.reduce(async (previous) => {
    await previous;
    await page.mouse.wheel(0, SCROLL_STEP_PX);
    await page.waitForTimeout(SETTLE_MS);
  }, Promise.resolve());
}

test.describe('a real scroll through the landing', () => {
  test('keeps the header sticky and clear of the hero shot at rest', async ({ page }) => {
    await page.goto('/');
    const header = page.locator('.site-header');
    await expect(header).toHaveCSS('position', 'sticky');
    const [headerBox, stageBox] = await Promise.all([header.boundingBox(), page.locator('.desk-stage').boundingBox()]);
    if (headerBox === null || stageBox === null) throw new Error('the header and the stage are laid out');
    expect(headerBox.y + headerBox.height).toBeLessThanOrEqual(stageBox.y + TOLERANCE_PX);
  });

  test('keeps the header at the top while the page scrolls', async ({ page }) => {
    await page.goto('/');
    await page.mouse.wheel(0, SCROLL_STEP_PX * 3);
    await page.waitForTimeout(SETTLE_MS);
    const headerBox = await page.locator('.site-header').boundingBox();
    if (headerBox === null) throw new Error('the header is laid out');
    expect(Math.abs(headerBox.y)).toBeLessThanOrEqual(TOLERANCE_PX);
  });

  test('shows every section fully drawn once scrolled in: the shot, the cards, the terminal, the final call and the footer', async ({
    page,
  }) => {
    await page.goto('/');
    await scrollThroughPage(page);
    await Promise.all(SECTIONS.map((selector) => expect(page.locator(selector)).toBeVisible()));
    const opacities = await Promise.all(
      SECTIONS.map((selector) => page.locator(selector).evaluate((node) => Number(getComputedStyle(node).opacity))),
    );
    opacities.forEach((opacity) => expect(opacity).toBeGreaterThan(OPAQUE_ENOUGH));
    await expect(page.locator('.terminal-command').first()).toContainText('claude mcp add');
    await expect(page.locator('.final-call .download-button')).toBeVisible();
  });

  test('loads the hero window shot into its frame, filling the stage', async ({ page }) => {
    await page.goto('/');
    const image = page.locator('.shot-window img');
    const isWide = await page.evaluate(() => window.innerWidth >= 640);
    test.skip(!isWide, 'the phone shows no window shot');
    await expect(image).toHaveJSProperty('complete', true);
    const [stageBox, imageBox] = await Promise.all([page.locator('.desk-stage').boundingBox(), image.boundingBox()]);
    if (stageBox === null || imageBox === null) throw new Error('the stage and the shot are laid out');
    expect(imageBox.x).toBeGreaterThanOrEqual(stageBox.x - TOLERANCE_PX);
    expect(imageBox.x + imageBox.width).toBeLessThanOrEqual(stageBox.x + stageBox.width + TOLERANCE_PX);
    expect(imageBox.y + imageBox.height).toBeLessThanOrEqual(stageBox.y + stageBox.height + TOLERANCE_PX);
  });
});
