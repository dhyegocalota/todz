import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ColorScheme, DocsViewport, expect, test } from './support/docs-walk';

type SchemeLook = { logo: string; background: string; link: string };

const LOOK_OF: Record<ColorScheme, SchemeLook> = {
  [ColorScheme.Light]: { logo: '/logo/light.svg', background: 'rgb(242, 244, 250)', link: 'rgb(47, 91, 255)' },
  [ColorScheme.Dark]: { logo: '/logo/dark.svg', background: 'rgb(7, 8, 18)', link: 'rgb(124, 149, 255)' },
};
const NAVBAR_LINK = 'https://todz.app';
const CONTENT_LINK = 'a.link[href="/connect-an-agent"]';
const FOOTER = 'footer';
const DOCS_CONFIGURATION = resolve(import.meta.dirname, '..', 'docs.json');
const footerLink = (
  JSON.parse(readFileSync(DOCS_CONFIGURATION, 'utf8')) as { footer: { links: { items: { label: string; href: string }[] }[] } }
).footer.links[0]!.items[0]!;

for (const scheme of Object.values(ColorScheme)) {
  test.describe(`the brand in ${scheme}`, () => {
    test.use({ colorScheme: scheme });

    test('shows the logo of the scheme and wears the landing colours', async ({ page }) => {
      await page.goto('/quickstart');
      await expect(page.locator(`img[src$="${LOOK_OF[scheme].logo}"]`).locator('visible=true').first()).toBeVisible();
      const colors = await page.evaluate((contentLink) => {
        const link = document.querySelector(contentLink);
        if (link === null) throw new Error('the page has no content link');
        return { background: getComputedStyle(document.documentElement).backgroundColor, link: getComputedStyle(link).borderBottomColor };
      }, CONTENT_LINK);
      expect(colors).toEqual({ background: LOOK_OF[scheme].background, link: LOOK_OF[scheme].link });
    });

    test('credits Logic Bit in the footer and links the landing from the navbar', async ({ page }, testInfo) => {
      await page.goto('/');
      const credit = page.locator(FOOTER).getByRole('link', { name: footerLink.label });
      await expect(credit).toHaveAttribute('href', footerLink.href);
      test.skip(testInfo.project.name !== DocsViewport.Desktop);
      await expect(page.locator('header').getByRole('link', { name: 'todz.app' })).toHaveAttribute('href', NAVBAR_LINK);
    });
  });
}
