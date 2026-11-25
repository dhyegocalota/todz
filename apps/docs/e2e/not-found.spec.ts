import { expect, test } from './support/docs-walk';

const MISSING_PATH = '/no-such-page';
const NOT_FOUND_STATUS = 404;
const NOT_FOUND_TITLE = 'Page not found';
const INTRODUCTION_LINK = 'Back to the Introduction';
const INTRODUCTION_TITLE = 'Introduction';

test.use({ missingPath: MISSING_PATH });

test('a missing page says so and its link reaches the Introduction', async ({ page }) => {
  const response = await page.goto(MISSING_PATH);
  expect(response?.status()).toBe(NOT_FOUND_STATUS);
  await expect(page.getByRole('heading', { name: NOT_FOUND_TITLE, level: 1, exact: true })).toBeVisible();
  await page.getByRole('link', { name: INTRODUCTION_LINK }).click();
  await expect(page).toHaveURL('/');
  await expect(page.locator('h1').first()).toHaveText(INTRODUCTION_TITLE);
});
