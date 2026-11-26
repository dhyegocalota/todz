import { ColorScheme, DocsViewport, docsPages, expect, test } from './support/docs-walk';

const NAVIGATION_BUTTON_NAME = /^Navigation/;
const SIDEBAR_LINKS = 'nav#sidebar a';
const MENU_LINKS = 'a[href]';
const SIDEBAR_TITLES = [
  'Introduction',
  'Quickstart',
  'Install on Mac',
  'Connect an agent',
  'Workspaces',
  'Keyboard shortcuts',
  'Updates',
  'Privacy',
  'Troubleshooting',
  'Uninstall',
  'Use these docs from your agent',
  'Open source',
  'MCP tools',
  'Releases',
  'Server setup',
];
const pages = docsPages();

for (const scheme of Object.values(ColorScheme)) {
  test.describe(`the pages in ${scheme}`, () => {
    test.use({ colorScheme: scheme });

    for (const { name, path, title } of pages) {
      test(`${name} shows its title as its heading and does not scroll sideways`, async ({ page }) => {
        await page.goto(path);
        await expect(page.locator('h1').first()).toHaveText(title);
        const widths = await page.evaluate(() => ({
          content: document.documentElement.scrollWidth,
          window: document.documentElement.clientWidth,
        }));
        expect(widths.content).toBeLessThanOrEqual(widths.window);
      });
    }

    test('the sidebar lists the titles in the order of the navigation', async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== DocsViewport.Desktop);
      await page.goto('/');
      await expect(page.locator(SIDEBAR_LINKS)).toHaveText(SIDEBAR_TITLES);
    });

    test('the menu opens and lists the titles', async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== DocsViewport.Narrow);
      await page.goto('/');
      await page.getByRole('button', { name: NAVIGATION_BUTTON_NAME }).click();
      const menuTitles = await page
        .locator(MENU_LINKS)
        .filter({ hasText: new RegExp(`^(${SIDEBAR_TITLES.join('|')})$`) })
        .allInnerTexts();
      expect(SIDEBAR_TITLES.filter((title) => !menuTitles.includes(title))).toEqual([]);
    });
  });
}
