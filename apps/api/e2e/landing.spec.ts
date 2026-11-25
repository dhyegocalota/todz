import { MILLISECONDS_PER_SECOND, WAITLIST_FILL_HOLD_MS } from '@todz/types';
import { type ConsoleMessage, type Locator, type Page, type Request, type Route, expect, test } from '@playwright/test';
import { ARIA_DISABLED, HONEYPOT_FIELD_NAME, STAMP_FIELD_NAME } from '../src/site/join-form-markup';
import { LANDING_COPY } from '../src/site/landing-copy';
import { LANDING_SHOTS, LandingShot } from '../src/site/landing-shots';
import { ProjectName } from './project-name';
import { mailCountTo } from './server-log';
import {
  FAILED_BEFORE_PRESS_TURNSTILE_STUB,
  FAILED_MARKER_ATTRIBUTE,
  JAVASCRIPT_CONTENT_TYPE,
  NEVER_SOLVING_TURNSTILE_STUB,
  RESET_COUNT_ATTRIBUTE,
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

const BRAND_ASSET_PATH = '/brand/todz-lockup.png';
const OK_STATUS = 200;
const STRICT_TRANSPORT_SECURITY = 'max-age=31536000';
const JOINED_NOTICE = "You're on the list. Check your inbox.";
const TOO_MANY_STATUS = 429;
const FORBIDDEN_STATUS = 403;
const RETRY_AFTER_SECONDS = 2;
const ACCEPT_HEADER = 'accept';
const JSON_MEDIA_TYPE = 'application/json';
const JOINED_OUTCOME = 'joined';
const STAMP_FIELD = STAMP_FIELD_NAME;
const HONEYPOT_FIELD = HONEYPOT_FIELD_NAME;
const HONEYPOT_VALUE = 'https://spam.example';
const STAMP_PATTERN = /^\d{13}\.[A-Za-z0-9_-]{43}$/;
const POLICY_HEADER = 'content-security-policy';
const UNSAFE_INLINE = "'unsafe-inline'";
const CONNECT_DIRECTIVE = "connect-src 'self'";
const ANSWERED_LINES: { name: string; answer: (route: Route) => Promise<void>; line: string }[] = [
  {
    name: 'invalid, 400',
    answer: (route) => route.fulfill({ status: 400, contentType: JSON_MEDIA_TYPE, body: JSON.stringify({ outcome: 'invalid' }) }),
    line: LANDING_COPY.join.invalid,
  },
  {
    name: 'check-failed, 403',
    answer: (route) =>
      route.fulfill({ status: FORBIDDEN_STATUS, contentType: JSON_MEDIA_TYPE, body: JSON.stringify({ outcome: 'check-failed' }) }),
    line: LANDING_COPY.join.checkFailed,
  },
  {
    name: 'opens-soon, 503',
    answer: (route) => route.fulfill({ status: 503, contentType: JSON_MEDIA_TYPE, body: JSON.stringify({ outcome: 'opens-soon' }) }),
    line: LANDING_COPY.join.opensSoon,
  },
  { name: 'an aborted request', answer: (route) => route.abort(), line: LANDING_COPY.join.unreachable },
  {
    name: 'a 200 answer that is HTML',
    answer: (route) => route.fulfill({ status: OK_STATUS, contentType: 'text/html', body: '<p>not the join answer</p>' }),
    line: LANDING_COPY.join.unreachable,
  },
];
const DOCS_SELF_HOST_URL = 'https://docs.todz.app/self-host';
const MOVED_PERMANENTLY_STATUS = 301;
const DOCS_REDIRECT_CACHE_CONTROL = 'max-age=3600';
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

function webpPathsOf(shot: LandingShot): string[] {
  return LANDING_SHOTS[shot].webp.map(({ path }) => path);
}

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

function joinPostsOf(page: Page): Request[] {
  const posts: Request[] = [];
  page.on('request', (request) => request.method() === 'POST' && new URL(request.url()).pathname === SitePath.Join && posts.push(request));
  return posts;
}

function onlyPost(posts: Request[]): Request {
  const [post, ...others] = posts;
  if (post === undefined || others.length > 0) throw new Error('exactly one join was posted');
  return post;
}

function postFieldsOf(post: Request): URLSearchParams {
  const body = post.postData();
  if (body === null) throw new Error('the join post has a body');
  return new URLSearchParams(body);
}

function navigationsOf(page: Page): { count: number } {
  const navigations = { count: 0 };
  page.on('framenavigated', (frame) => frame === page.mainFrame() && (navigations.count += 1));
  return navigations;
}

async function landingWithoutTheHold(page: Page): Promise<void> {
  await page.clock.install();
  await page.goto(SitePath.Landing);
  await page.clock.fastForward(WAITLIST_FILL_HOLD_MS);
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
    onlyOn(ProjectName.Desktop);
    await page.goto(SitePath.Landing);
    const windowImage = page.locator('.shot-window img');
    await expect(windowImage).toHaveJSProperty('complete', true);
    expect(webpPathsOf(LandingShot.Window)).toContain(
      await windowImage.evaluate((image: HTMLImageElement) => new URL(image.currentSrc).pathname),
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

  test('applies the dark tokens', async ({ page }) => {
    await page.goto(SitePath.Landing);
    const pageColor = await page.locator('body').evaluate((body) => getComputedStyle(body).backgroundColor);
    expect(darkestChannelLimitHolds(pageColor)).toBe(true);
  });

  test('loads the dark window shot', async ({ page }) => {
    onlyOn(ProjectName.Desktop);
    await page.goto(SitePath.Landing);
    const windowImage = page.locator('.shot-window img');
    await expect(windowImage).toHaveJSProperty('complete', true);
    expect(webpPathsOf(LandingShot.WindowDark)).toContain(
      await windowImage.evaluate((image: HTMLImageElement) => new URL(image.currentSrc).pathname),
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
    test(`the ${form} form joins in place with one JSON post and answers "${JOINED_NOTICE}" without echoing the address`, async ({
      page,
    }) => {
      const address = uniqueAddress();
      await page.goto(SitePath.Landing);
      const landingUrl = page.url();
      const posts = joinPostsOf(page);
      const navigations = navigationsOf(page);
      await submitForm({ page, form, address });
      await expect(page.locator(`#${form}-notice`)).toHaveText(JOINED_NOTICE);
      expect(page.url()).toBe(landingUrl);
      expect(navigations.count).toBe(0);
      expect(posts).toHaveLength(1);
      const post = onlyPost(posts);
      expect(post.headers()[ACCEPT_HEADER]).toContain(JSON_MEDIA_TYPE);
      const fields = postFieldsOf(post);
      expect(fields.get(TURNSTILE_RESPONSE_FIELD)).toBe(TURNSTILE_DUMMY_TOKEN);
      expect(fields.get(STAMP_FIELD)).toMatch(STAMP_PATTERN);
      expect(fields.get(HONEYPOT_FIELD)).toBe('');
      const response = await post.response();
      expect(response?.status()).toBe(OK_STATUS);
      expect(await response?.json()).toEqual({ outcome: JOINED_OUTCOME });
      await expect(page.locator(`form#${form} input[name="email"]`)).toHaveValue('');
      expect(await page.content()).not.toContain(address);
      await expect.poll(() => mailCountTo(address)).toBe(1);
    });
  });

  test.describe('while the check is not solved', () => {
    test('the button is aria-disabled until the token arrives', async ({ page }) => {
      await page.route(TURNSTILE_SCRIPT_URL, (route) => route.fulfill({ contentType: JAVASCRIPT_CONTENT_TYPE, body: SLOW_TURNSTILE_STUB }));
      const button = page.locator(`form#${Fragment.Hero} button[type="submit"]`);
      await page.goto(SitePath.Landing, { waitUntil: 'domcontentloaded' });
      await expect(button).toHaveAttribute(ARIA_DISABLED, 'true');
      await expect(button).not.toHaveAttribute(ARIA_DISABLED, 'true');
    });

    test('a press posts nothing and says to finish the check', async ({ page }) => {
      await page.route(TURNSTILE_SCRIPT_URL, (route) =>
        route.fulfill({ contentType: JAVASCRIPT_CONTENT_TYPE, body: NEVER_SOLVING_TURNSTILE_STUB }),
      );
      const posts = joinPostsOf(page);
      await page.goto(SitePath.Landing);
      await page.locator(`form#${Fragment.Hero} input[name="email"]`).fill(uniqueAddress());
      await page.locator(`form#${Fragment.Hero} button[type="submit"]`).click({ force: true });
      await expect(page.locator(`#${Fragment.Hero}-notice`)).toHaveText(LANDING_COPY.join.waitingForCheck);
      expect(posts).toEqual([]);
    });

    test('the script of the check never loading leaves the button waiting and says the check could not load', async ({ page }) => {
      await page.route(TURNSTILE_SCRIPT_URL, (route) => route.abort());
      await page.goto(SitePath.Landing);
      await expect(page.locator(`#${Fragment.Hero}-notice`)).toHaveText(LANDING_COPY.join.checkError);
      await expect(page.locator(`form#${Fragment.Hero} button[type="submit"]`)).toHaveAttribute(ARIA_DISABLED, 'true');
    });

    test('the widget erroring leaves the button waiting and says the check could not load', async ({ page }) => {
      await page.route(TURNSTILE_SCRIPT_URL, (route) =>
        route.fulfill({ contentType: JAVASCRIPT_CONTENT_TYPE, body: FAILED_BEFORE_PRESS_TURNSTILE_STUB }),
      );
      await page.goto(SitePath.Landing);
      await expect(page.locator(`html[${FAILED_MARKER_ATTRIBUTE}]`)).toHaveCount(1);
      await expect(page.locator(`#${Fragment.Hero}-notice`)).toHaveText(LANDING_COPY.join.checkError);
      await expect(page.locator(`form#${Fragment.Hero} button[type="submit"]`)).toHaveAttribute(ARIA_DISABLED, 'true');
    });
  });

  test('the widget is reset once after an answer and the button waits for the new token', async ({ page }) => {
    await page.goto(SitePath.Landing);
    await submitForm({ page, form: Fragment.Hero, address: uniqueAddress() });
    await expect(page.locator(`#${Fragment.Hero}-notice`)).toHaveText(JOINED_NOTICE);
    await expect(page.locator('html')).toHaveAttribute(RESET_COUNT_ATTRIBUTE, '1');
    await expect(page.locator(`form#${Fragment.Hero} button[type="submit"]`)).not.toHaveAttribute(ARIA_DISABLED, 'true');
  });

  test('the same address twice answers the same line both times and sends one mail', async ({ page }) => {
    const address = uniqueAddress();
    await page.goto(SitePath.Landing);
    const posts = joinPostsOf(page);
    await submitForm({ page, form: Fragment.Hero, address });
    await expect(page.locator(`#${Fragment.Hero}-notice`)).toHaveText(JOINED_NOTICE);
    await submitForm({ page, form: Fragment.Final, address });
    await expect(page.locator(`#${Fragment.Final}-notice`)).toHaveText(JOINED_NOTICE);
    expect(posts).toHaveLength(2);
    const responses = await Promise.all(posts.map((post) => post.response().then((response) => response?.json())));
    expect(responses).toEqual([{ outcome: JOINED_OUTCOME }, { outcome: JOINED_OUTCOME }]);
    await expect.poll(() => mailCountTo(address)).toBe(1);
  });

  test('a filled honeypot answers joined and keeps nothing, and a real join of the address afterwards is kept', async ({ page }) => {
    const address = uniqueAddress();
    await page.goto(SitePath.Landing);
    await page.locator(`form#${Fragment.Hero} input[name="${HONEYPOT_FIELD}"]`).evaluate((input: HTMLInputElement, value) => {
      input.value = value;
    }, HONEYPOT_VALUE);
    await submitForm({ page, form: Fragment.Hero, address });
    await expect(page.locator(`#${Fragment.Hero}-notice`)).toHaveText(JOINED_NOTICE);
    expect(mailCountTo(address)).toBe(0);
    await page.reload();
    await submitForm({ page, form: Fragment.Hero, address });
    await expect(page.locator(`#${Fragment.Hero}-notice`)).toHaveText(JOINED_NOTICE);
    await expect.poll(() => mailCountTo(address)).toBe(1);
  });

  test('a submit faster than the server minimum answers joined and keeps nothing, and a real join afterwards is kept', async ({
    page,
    browser,
    baseURL,
  }) => {
    const address = uniqueAddress();
    await landingWithoutTheHold(page);
    await submitForm({ page, form: Fragment.Hero, address });
    await expect(page.locator(`#${Fragment.Hero}-notice`)).toHaveText(JOINED_NOTICE);
    expect(mailCountTo(address)).toBe(0);
    const patientContext = await browser.newContext({ baseURL });
    const patientPage = await patientContext.newPage();
    await patientPage.route(TURNSTILE_SCRIPT_URL, (route) => route.fulfill({ contentType: JAVASCRIPT_CONTENT_TYPE, body: TURNSTILE_STUB }));
    await patientPage.goto(SitePath.Landing);
    await submitForm({ page: patientPage, form: Fragment.Hero, address });
    await expect(patientPage.locator(`#${Fragment.Hero}-notice`)).toHaveText(JOINED_NOTICE);
    await expect.poll(() => mailCountTo(address)).toBe(1);
    await patientContext.close();
  });

  test.describe('each answer the server can give shows its own line and gives the button back', () => {
    ANSWERED_LINES.forEach(({ name, answer, line }) => {
      test(name, async ({ page }) => {
        await page.route(`**${SitePath.Join}`, (route) => (route.request().method() === 'POST' ? answer(route) : route.continue()));
        await landingWithoutTheHold(page);
        await submitForm({ page, form: Fragment.Hero, address: uniqueAddress() });
        await expect(page.locator(`#${Fragment.Hero}-notice`)).toHaveText(line);
        await expect(page.locator(`form#${Fragment.Hero} button[type="submit"]`)).toHaveText(LANDING_COPY.join.submit);
        await expect(page.locator('html')).toHaveAttribute(RESET_COUNT_ATTRIBUTE, '1');
      });
    });
  });

  test('a try again with Retry-After keeps the button waiting until the delay has passed', async ({ page }) => {
    await page.route(`**${SitePath.Join}`, (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({
            status: TOO_MANY_STATUS,
            contentType: JSON_MEDIA_TYPE,
            headers: { 'Retry-After': String(RETRY_AFTER_SECONDS) },
            body: JSON.stringify({ outcome: 'try-again' }),
          })
        : route.continue(),
    );
    const button = page.locator(`form#${Fragment.Hero} button[type="submit"]`);
    await landingWithoutTheHold(page);
    await submitForm({ page, form: Fragment.Hero, address: uniqueAddress() });
    await expect(page.locator(`#${Fragment.Hero}-notice`)).toHaveText(LANDING_COPY.join.tryAgain);
    await expect(page.locator(`form#${Fragment.Hero} input[name="${TURNSTILE_RESPONSE_FIELD}"]`)).toHaveValue(TURNSTILE_DUMMY_TOKEN);
    await expect(button).toHaveAttribute(ARIA_DISABLED, 'true');
    await page.clock.fastForward(RETRY_AFTER_SECONDS * MILLISECONDS_PER_SECOND);
    await expect(button).not.toHaveAttribute(ARIA_DISABLED, 'true');
  });

  test('a post with no token answers check-failed in JSON, and so does a token that is not one', async ({ request }) => {
    const forms: Record<string, string>[] = [
      { email: uniqueAddress() },
      { email: uniqueAddress(), [TURNSTILE_RESPONSE_FIELD]: 'bad token!' },
    ];
    const answers = await Promise.all(
      forms.map((form) => request.post(SitePath.Join, { headers: { [ACCEPT_HEADER]: JSON_MEDIA_TYPE }, form })),
    );
    expect(answers.map((answer) => answer.status())).toEqual([FORBIDDEN_STATUS, FORBIDDEN_STATUS]);
    expect(await Promise.all(answers.map((answer) => answer.json()))).toEqual([{ outcome: 'check-failed' }, { outcome: 'check-failed' }]);
  });

  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    test('a press posts the form and the browser lands on the try again page, 429', async ({ page }) => {
      await page.goto(SitePath.Landing);
      await page.locator(`form#${Fragment.Hero} input[name="email"]`).fill(uniqueAddress());
      const [response] = await Promise.all([
        page.waitForResponse((answer) => answer.request().method() === 'POST' && new URL(answer.url()).pathname === SitePath.Join),
        page.locator(`form#${Fragment.Hero} button[type="submit"]`).click(),
      ]);
      expect(response.status()).toBe(TOO_MANY_STATUS);
      await expect(page).toHaveURL(new RegExp(`${SitePath.Join}#${Fragment.Hero}$`));
      await expect(page.locator(`#${Fragment.Hero}-notice`)).toHaveText(LANDING_COPY.join.tryAgain);
    });
  });

  test('the policy has no unsafe-inline and a join raises no violation and no console error', async ({ page, baseURL }) => {
    const { errors } = watchConsoleAndNetwork({ page, baseURL });
    await page.addInitScript(() => {
      const violations: string[] = [];
      Object.assign(window, { violations });
      document.addEventListener('securitypolicyviolation', (event) => violations.push(event.violatedDirective));
    });
    const landing = await page.goto(SitePath.Landing);
    const policy = landing?.headers()[POLICY_HEADER];
    expect(policy).not.toContain(UNSAFE_INLINE);
    expect(policy).toContain(CONNECT_DIRECTIVE);
    await submitForm({ page, form: Fragment.Hero, address: uniqueAddress() });
    await expect(page.locator(`#${Fragment.Hero}-notice`)).toHaveText(JOINED_NOTICE);
    expect(await page.evaluate(() => Reflect.get(window, 'violations'))).toEqual([]);
    expect(errors).toEqual([]);
  });

  [ColorScheme.Light, ColorScheme.Dark].forEach((colorScheme) => {
    test.describe(`the check in the ${colorScheme} scheme`, () => {
      test.use({ colorScheme });

      test('sits inside its form and the viewport, follows the scheme and adds no horizontal scroll', async ({ page }) => {
        await page.goto(SitePath.Landing);
        const fits = await Promise.all(
          JOIN_FORMS.map((form) =>
            page.locator(`form#${form}`).evaluate((formElement) => {
              const widget = formElement.querySelector('.cf-turnstile');
              if (widget === null) throw new Error('the form holds no widget');
              const formBox = formElement.getBoundingClientRect();
              const widgetBox = widget.getBoundingClientRect();
              return {
                theme: widget.getAttribute('data-theme'),
                isInsideForm: widgetBox.left >= formBox.left && widgetBox.right <= formBox.right,
                isInsideViewport: widgetBox.left >= 0 && widgetBox.right <= window.innerWidth,
              };
            }),
          ),
        );
        expect(fits).toEqual(JOIN_FORMS.map(() => ({ theme: 'auto', isInsideForm: true, isInsideViewport: true })));
        expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
      });
    });
  });

  test('a direct GET of /join lands on the landing page', async ({ page }) => {
    await page.goto(SitePath.Join);
    await expect(page).toHaveURL(new RegExp(`${SitePath.Landing}$`));
    await expect(page.locator('.join-notice')).toHaveCount(0);
  });
});

test.describe('static assets', () => {
  test('a static asset answers with strict transport security, nosniff and no referrer', async ({ request }) => {
    const response = await request.get(BRAND_ASSET_PATH);
    expect(response.status()).toBe(OK_STATUS);
    expect(response.headers()).toMatchObject({
      'strict-transport-security': STRICT_TRANSPORT_SECURITY,
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
    });
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
    expect(response.headers()['cache-control']).toBe(DOCS_REDIRECT_CACHE_CONTROL);
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
    await expect(page.locator(`#${Fragment.Hero}-notice`)).toHaveText(JOINED_NOTICE);
    expect({ errors, foreignRequests }).toEqual({ errors: [], foreignRequests: [] });
  });
});
