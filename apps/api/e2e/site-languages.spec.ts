import { expect, test } from '@playwright/test';
import { LANGUAGE_PROFILES, Language } from '@todz/types';
import { PreferenceCookie, Theme } from '../src/page-preferences';
import { ProjectName } from './project-name';

const LANDING_PATH = '/';
const CLOUD_QUEUE_PATH = '/cloud-queue';
const PRODUCTION_ORIGIN = 'https://todz.app';
const CRAWLER_USER_AGENT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const LIGHT_PAGE_COLOR = '#F2F4FA';
const DARK_PAGE_COLOR = '#070812';
const THEME_PAGE_COLOR: Record<Theme.Light | Theme.Dark, string> = { [Theme.Light]: LIGHT_PAGE_COLOR, [Theme.Dark]: DARK_PAGE_COLOR };
const PAGE_BACKGROUND: Record<Theme.Light | Theme.Dark, string> = { [Theme.Light]: 'rgb(242, 244, 250)', [Theme.Dark]: 'rgb(7, 8, 18)' };
const ALTERNATE_PATTERN = /<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g;
const OTHER_LANGUAGES = Object.values(Language).filter((language) => language !== Language.English);

function baseUrlOf(baseURL: string | undefined): string {
  if (baseURL === undefined) throw new Error('the project has a base URL');
  return baseURL;
}

function required<Value>(value: Value | null): Value {
  if (value === null) throw new Error('the element has a box');
  return value;
}

function attributeOf(value: string | undefined): string {
  if (value === undefined) throw new Error('the link carries the attribute');
  return value;
}

function urlPatternOf(path: string): RegExp {
  return new RegExp(`${path.replace('/', '\\/')}$`);
}

test.describe('the language selector', () => {
  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    test('opens, switches to Português (Brasil) and keeps the choice', async ({ page, context }) => {
      await page.goto(LANDING_PATH);
      await page.locator('summary.language-summary').click();
      await page.getByRole('button', { name: LANGUAGE_PROFILES[Language.PortugueseBrazil].nativeName }).click();
      await expect(page).toHaveURL(urlPatternOf('/pt-br/'));
      await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
      const cookies = await context.cookies();
      expect(cookies.find(({ name }) => name === PreferenceCookie.Language)?.value).toBe(Language.PortugueseBrazil);
      await page.goto(LANDING_PATH);
      await expect(page).toHaveURL(urlPatternOf('/pt-br/'));
    });

    test('switches the cloud queue page to its twin', async ({ page }) => {
      await page.goto(CLOUD_QUEUE_PATH);
      await page.locator('summary.language-summary').click();
      await page.getByRole('button', { name: LANGUAGE_PROFILES[Language.Japanese].nativeName }).click();
      await expect(page).toHaveURL(urlPatternOf('/ja/cloud-queue'));
      await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
    });
  });

  test.describe('with JavaScript', () => {
    test('opens, switches to 日本語, marks it current and switches back to English', async ({ page }) => {
      await page.goto(LANDING_PATH);
      await page.locator('summary.language-summary').click();
      await page.getByRole('button', { name: LANGUAGE_PROFILES[Language.Japanese].nativeName }).click();
      await expect(page).toHaveURL(urlPatternOf('/ja/'));
      await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
      await page.locator('summary.language-summary').click();
      await expect(page.locator('.language-option[aria-current=true]')).toHaveText(LANGUAGE_PROFILES[Language.Japanese].nativeName);
      await page.getByRole('button', { name: LANGUAGE_PROFILES[Language.English].nativeName }).click();
      await expect(page).toHaveURL(urlPatternOf('/'));
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    });

    test('keeps the scroll target when it switches language', async ({ page }) => {
      await page.goto('/ja/#ways');
      await page.locator('summary.language-summary').click();
      await page.getByRole('button', { name: LANGUAGE_PROFILES[Language.PortugueseBrazil].nativeName }).click();
      await expect(page).toHaveURL(/\/pt-br\/#ways$/);
      await expect(page.locator('#ways')).toBeInViewport();
    });

    test('lists the eight native names', async ({ page }) => {
      await page.goto(LANDING_PATH);
      await page.locator('summary.language-summary').click();
      await expect(page.locator('.language-option')).toHaveText(Object.values(LANGUAGE_PROFILES).map(({ nativeName }) => nativeName));
    });
  });
});

test.describe('the theme', () => {
  test.describe('the first response', () => {
    for (const theme of [Theme.Light, Theme.Dark]) {
      test(`already carries data-theme and color-scheme ${theme} for its cookie`, async ({ request }) => {
        const response = await request.get(LANDING_PATH, { headers: { Cookie: `${PreferenceCookie.Theme}=${theme}` } });
        const html = await response.text();
        expect(html).toContain(`<html lang="en" dir="ltr" data-theme="${theme}">`);
        expect(html).toContain(`<meta name="color-scheme" content="${theme}">`);
      });
    }

    test('carries neither for the system theme', async ({ request }) => {
      const html = await (await request.get(LANDING_PATH)).text();
      expect(html).toContain('<html lang="en" dir="ltr">');
      expect(html).toContain('<meta name="color-scheme" content="light dark">');
    });
  });

  test.describe('the first paint, with JavaScript off', () => {
    test.use({ javaScriptEnabled: false });

    for (const [theme, operatingSystemScheme] of [
      [Theme.Dark, 'light'],
      [Theme.Light, 'dark'],
    ] as const) {
      test(`paints ${theme} against a ${operatingSystemScheme} system with no script at all`, async ({ browser, baseURL }) => {
        const context = await browser.newContext({ javaScriptEnabled: false, colorScheme: operatingSystemScheme });
        await context.addCookies([{ name: PreferenceCookie.Theme, value: theme, url: baseUrlOf(baseURL) }]);
        const page = await context.newPage();
        await page.goto(LANDING_PATH);
        await expect(page.locator('html')).toHaveCSS('color-scheme', theme);
        await expect(page.locator('body')).toHaveCSS('background-color', PAGE_BACKGROUND[theme]);
        await context.close();
      });
    }
  });

  test.describe('the first paint', () => {
    for (const [theme, operatingSystemScheme] of [
      [Theme.Dark, 'light'],
      [Theme.Light, 'dark'],
    ] as const) {
      test(`${theme} wins over a ${operatingSystemScheme} system on the first paint`, async ({ browser, baseURL }) => {
        const context = await browser.newContext({ colorScheme: operatingSystemScheme });
        await context.addCookies([{ name: PreferenceCookie.Theme, value: theme, url: baseUrlOf(baseURL) }]);
        const page = await context.newPage();
        await page.addInitScript(() => {
          document.addEventListener('DOMContentLoaded', () => {
            const style = getComputedStyle(document.documentElement);
            (window as unknown as { firstPageColor: string }).firstPageColor = style.getPropertyValue('--color-page').trim();
          });
        });
        await page.goto(LANDING_PATH);
        const firstPageColor = await page.evaluate(() => (window as unknown as { firstPageColor: string }).firstPageColor);
        expect(firstPageColor.toUpperCase()).toBe(THEME_PAGE_COLOR[theme]);
        await expect(page.locator('html')).toHaveCSS('color-scheme', theme);
        await context.close();
      });
    }

    test('follows the system when there is no cookie', async ({ browser }) => {
      const context = await browser.newContext({ colorScheme: 'dark' });
      const page = await context.newPage();
      await page.goto(LANDING_PATH);
      const pageColor = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-page').trim());
      expect(pageColor.toUpperCase()).toBe(DARK_PAGE_COLOR);
      await context.close();
    });
  });

  test.describe('the control without JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    test('posts the choice, comes back with the attribute and keeps it on another page', async ({ page }) => {
      await page.goto(LANDING_PATH);
      await page.locator('.theme-option[value=dark]').click();
      await expect(page).toHaveURL(urlPatternOf('/'));
      await expect(page.locator('html')).toHaveAttribute('data-theme', Theme.Dark);
      await expect(page.locator('.theme-option[value=dark]')).toHaveAttribute('aria-pressed', 'true');
      await page.goto(CLOUD_QUEUE_PATH);
      await expect(page.locator('html')).toHaveAttribute('data-theme', Theme.Dark);
    });
  });

  test.describe('the control with JavaScript', () => {
    test('applies the choice at once, without a reload, and persists it', async ({ page }) => {
      await page.goto(LANDING_PATH);
      await page.evaluate(() => {
        (window as unknown as { stillHere: boolean }).stillHere = true;
      });
      await page.locator('.theme-option[value=dark]').click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', Theme.Dark);
      await expect(page.locator('meta[name=color-scheme]')).toHaveAttribute('content', Theme.Dark);
      expect(await page.evaluate(() => (window as unknown as { stillHere?: boolean }).stillHere)).toBe(true);
      await expect(page.locator('meta[name=theme-color]')).toHaveCount(1);
      await expect(page.locator('meta[name=theme-color]')).toHaveAttribute('content', DARK_PAGE_COLOR);
      await expect(page.locator('[data-theme-source]')).toHaveAttribute('media', '');
      await page.locator('.theme-option[value=light]').click();
      await expect(page.locator('meta[name=theme-color]')).toHaveAttribute('content', LIGHT_PAGE_COLOR);
      await expect(page.locator('[data-theme-source]')).toHaveAttribute('media', 'not all');
      await page.locator('.theme-option[value=dark]').click();
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-theme', Theme.Dark);
      await page.locator('.theme-option[value=system]').click();
      await expect(page.locator('meta[name=theme-color]')).toHaveCount(2);
      await expect(page.locator('[data-theme-source]')).toHaveAttribute('media', '(prefers-color-scheme: dark)');
      await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
      await page.reload();
      await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
    });
  });
});

test.describe('hreflang', () => {
  test('the alternates of the landing resolve to pages in their own language', async ({ page, request, baseURL }) => {
    const html = await (await request.get(LANDING_PATH)).text();
    const alternates = [...html.matchAll(ALTERNATE_PATTERN)].map(([, hreflang, href]) => ({
      hreflang: attributeOf(hreflang),
      href: attributeOf(href),
    }));
    expect(alternates).toHaveLength(Object.values(Language).length + 1);
    for (const { hreflang, href } of alternates) {
      const isDefault = hreflang === 'x-default';
      await page.goto(`${baseURL}${href.replace(PRODUCTION_ORIGIN, '')}`);
      await expect(page.locator('html')).toHaveAttribute('lang', isDefault ? 'en' : hreflang);
    }
  });

  test('every page names its own canonical and the English x-default', async ({ request }) => {
    for (const language of OTHER_LANGUAGES) {
      const { pathPrefix } = LANGUAGE_PROFILES[language];
      const html = await (await request.get(`${pathPrefix}/`)).text();
      expect(html).toContain(`<link rel="canonical" href="${PRODUCTION_ORIGIN}${pathPrefix}/">`);
      expect(html).toContain(`<link rel="alternate" hreflang="x-default" href="${PRODUCTION_ORIGIN}/">`);
    }
  });
});

test.describe('the first visit', () => {
  test('sends a Japanese browser to /ja/ once and remembers it', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ locale: 'ja-JP' });
    const page = await context.newPage();
    await page.goto(`${baseURL}${LANDING_PATH}`);
    await expect(page).toHaveURL(urlPatternOf('/ja/'));
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
    const cookies = await context.cookies();
    expect(cookies.find(({ name }) => name === PreferenceCookie.Language)?.value).toBe(Language.Japanese);
    await context.close();
  });

  test('lets a person choose English afterwards, whatever the browser says', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ locale: 'ja-JP' });
    const page = await context.newPage();
    await page.goto(`${baseURL}${LANDING_PATH}`);
    await page.locator('summary.language-summary').click();
    await page.getByRole('button', { name: LANGUAGE_PROFILES[Language.English].nativeName }).click();
    await expect(page).toHaveURL(urlPatternOf('/'));
    await page.goto(`${baseURL}${LANDING_PATH}`);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await context.close();
  });

  test('never redirects a crawler', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ locale: 'ja-JP', userAgent: CRAWLER_USER_AGENT });
    const page = await context.newPage();
    await page.goto(`${baseURL}${LANDING_PATH}`);
    await expect(page).toHaveURL(urlPatternOf('/'));
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    expect((await context.cookies()).filter(({ name }) => name === PreferenceCookie.Language)).toEqual([]);
    await context.close();
  });

  test('keeps English for Traditional Chinese', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ locale: 'zh-TW' });
    const page = await context.newPage();
    await page.goto(`${baseURL}${LANDING_PATH}`);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await context.close();
  });
});

test.describe('the controls live in the footer', () => {
  test('are in the footer and absent from the header', async ({ page }) => {
    await page.goto(LANDING_PATH);
    await expect(page.locator('.site-footer .language-menu')).toHaveCount(1);
    await expect(page.locator('.site-footer .theme-form')).toHaveCount(1);
    await expect(page.locator('.site-header .language-menu')).toHaveCount(0);
    await expect(page.locator('.site-header .theme-form')).toHaveCount(0);
    await expect(page.locator('.language-summary')).toHaveAttribute('aria-label', 'Language: EN');
    await expect(page.locator('.language-summary')).toHaveAttribute('aria-expanded', 'false');
  });

  test('an outside click closes the menu and keeps aria-expanded in sync', async ({ page }) => {
    await page.goto(LANDING_PATH);
    await page.locator('summary.language-summary').click();
    await expect(page.locator('.language-summary')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.language-form')).toBeVisible();
    await page.locator('.hero-title').click();
    await expect(page.locator('.language-form')).toBeHidden();
    await expect(page.locator('.language-summary')).toHaveAttribute('aria-expanded', 'false');
  });

  test('Escape closes the menu and returns focus to the trigger', async ({ page }) => {
    await page.goto(LANDING_PATH);
    await page.locator('summary.language-summary').click();
    await page.locator('.language-option').nth(1).focus();
    await page.keyboard.press('Escape');
    await expect(page.locator('.language-form')).toBeHidden();
    await expect(page.locator('.language-summary')).toBeFocused();
    await expect(page.locator('.language-summary')).toHaveAttribute('aria-expanded', 'false');
  });

  test('choosing an option navigates', async ({ page }) => {
    await page.goto(LANDING_PATH);
    await page.locator('summary.language-summary').click();
    await page.getByRole('button', { name: LANGUAGE_PROFILES[Language.Korean].nativeName }).click();
    await expect(page).toHaveURL(urlPatternOf('/ko/'));
    await expect(page.locator('.language-summary')).toHaveAttribute('aria-label', /: KO$/);
  });

  test('never scrolls sideways, closed or open', async ({ page }) => {
    await page.goto(LANDING_PATH);
    const overflows = () => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(await overflows()).toBe(false);
    await page.locator('summary.language-summary').click();
    expect(await overflows()).toBe(false);
    await expect(page.locator('.language-form')).toBeInViewport();
  });
});

test.describe('Arabic and Hindi', () => {
  test('/ar/ is right to left and mirrors the header and the footer controls', async ({ page }) => {
    await page.goto('/ar/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    const viewportWidth = page.viewportSize()?.width;
    if (viewportWidth === undefined) throw new Error('the project has a viewport');
    const brand = required(await page.locator('.site-header .brand').boundingBox());
    expect(brand.x + brand.width / 2).toBeGreaterThan(viewportWidth / 2);
    await page.goto('/');
    const englishBrand = required(await page.locator('.site-header .brand').boundingBox());
    expect(englishBrand.x + englishBrand.width / 2).toBeLessThan(viewportWidth / 2);
  });

  test('/ar/ puts the footer controls on the right of the footer', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === ProjectName.Mobile, 'the footer controls are centred on a phone');
    await page.goto('/ar/');
    const viewportWidth = page.viewportSize()?.width;
    if (viewportWidth === undefined) throw new Error('the project has a viewport');
    const controls = required(await page.locator('.site-footer .footer-controls').boundingBox());
    expect(controls.x + controls.width / 2).toBeGreaterThan(viewportWidth / 2);
  });

  test('/ar/ keeps its terminal blocks and commands left to right', async ({ page }) => {
    await page.goto('/ar/');
    const directions = await page
      .locator('.terminal-body')
      .evaluateAll((blocks) => blocks.map((block) => getComputedStyle(block).direction));
    expect(directions.length).toBeGreaterThan(0);
    directions.forEach((direction) => expect(direction).toBe('ltr'));
    await expect(page.locator('.terminal-command').first()).toContainText('claude mcp add');
  });

  test('/ar/ and /hi/ never scroll sideways, and the language menu opens in view', async ({ page }) => {
    for (const path of ['/ar/', '/hi/']) {
      await page.goto(path);
      await page.locator('summary.language-summary').click();
      await expect(page.locator('.language-form')).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    }
  });

  test('/hi/ renders left to right with its own prefix and switcher entry', async ({ page }) => {
    await page.goto('/hi/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('.language-option[aria-current=true]')).toHaveText(LANGUAGE_PROFILES[Language.Hindi].nativeName);
  });

  test('the hreflang set holds ten languages and x-default', async ({ request }) => {
    const html = await (await request.get('/ar/')).text();
    const alternates = [...html.matchAll(ALTERNATE_PATTERN)];
    expect(alternates).toHaveLength(Object.values(Language).length + 1);
    expect(html).toContain('hreflang="ar" href="https://todz.app/ar/"');
    expect(html).toContain('hreflang="hi" href="https://todz.app/hi/"');
  });
});
