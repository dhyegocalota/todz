import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { type Browser, type BrowserContext, type Page, expect, test } from '@playwright/test';
import { PERSIST_FOLDER_VARIABLE } from './persist-folder';
import { OAUTH_ORIGIN, OAUTH_SERVER_LOG_FILE_NAME } from './site-environment';
import { JAVASCRIPT_CONTENT_TYPE, TURNSTILE_SCRIPT_URL, TURNSTILE_STUB } from './turnstile-stub';

const REDIRECT_URI = 'http://127.0.0.1:33418/callback';
const CLIENT_NAME = 'Claude Code';
const MCP_URL = `${OAUTH_ORIGIN}/mcp`;
const VERIFIER_BYTE_LENGTH = 32;
const LOGGED_MESSAGE_START = '{"to":';
const MAIL_POLL_TIMEOUT_MS = 15_000;
const CODE_PATTERN = /(?:^|\s)([0-9]{6})(?:\s|$)/;
const CODE_LABEL = 'Sign-in code';
const WRONG_CODE = '000000';
const CONSENT_TITLE = `Connect ${CLIENT_NAME} to todz?`;
const SIGN_IN_TITLE = `Sign in to connect ${CLIENT_NAME}`;
const RESEND_WAIT_LABEL = 'Resend code in 30s';
const RESEND_LABEL = 'Resend code';
const WRONG_NOTICE = "That code didn't work. Check it and try again.";
const COUNTDOWN_MS = 31_000;
const BOX_SELECTOR = '.code-box';
const FIELD_SELECTOR = '.code-field';
const WRONG_STATE = 'wrong';
const SHAKE_ANIMATION = 'code-shake';
const NO_ANIMATION = 'none';
const CHECK_INBOX = 'Check your inbox';
const PASTE_SCRIPT = (text: string): void => {
  const data = new DataTransfer();
  data.setData('text', text);
  document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
};

type MailedMessage = { to: string; text: string };

type Challenge = { challenge: string; verifier: string };

function serverLogPath(): string {
  const persistFolder = process.env[PERSIST_FOLDER_VARIABLE];
  if (persistFolder === undefined) throw new Error('the Playwright configuration did not create the persist folder');
  return path.join(persistFolder, OAUTH_SERVER_LOG_FILE_NAME);
}

function lastMailedCodeTo(address: string): string | null {
  const [message] = fs
    .readFileSync(serverLogPath(), 'utf8')
    .split('\n')
    .filter((line) => line.includes(LOGGED_MESSAGE_START))
    .map((line) => JSON.parse(line.slice(line.indexOf(LOGGED_MESSAGE_START))) as MailedMessage)
    .filter((logged) => logged.to === address)
    .reverse();
  if (message === undefined) return null;
  const code = CODE_PATTERN.exec(message.text)?.[1];
  if (code === undefined) return null;
  return code;
}

async function mailedCodeTo(address: string): Promise<string> {
  await expect.poll(() => lastMailedCodeTo(address), { timeout: MAIL_POLL_TIMEOUT_MS }).not.toBeNull();
  const code = lastMailedCodeTo(address);
  if (code === null) throw new Error('the mail should carry a code');
  return code;
}

function pkceChallenge(): Challenge {
  const verifier = randomBytes(VERIFIER_BYTE_LENGTH).toString('base64url');
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') };
}

function freshAddress(): string {
  return `${randomBytes(8).toString('hex')}@example.com`;
}

async function authorizeUrl(browser: Browser): Promise<string> {
  const context = await browser.newContext();
  const response = await context.request.post(`${OAUTH_ORIGIN}/oauth/register`, {
    data: { client_name: CLIENT_NAME, redirect_uris: [REDIRECT_URI] },
  });
  const { client_id: clientId } = (await response.json()) as { client_id: string };
  await context.close();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    code_challenge: pkceChallenge().challenge,
    code_challenge_method: 'S256',
    state: 'e2e-state',
    resource: MCP_URL,
  });
  return `${OAUTH_ORIGIN}/oauth/authorize?${params}`;
}

async function browserContextOf(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext();
  await context.route(TURNSTILE_SCRIPT_URL, (route) => route.fulfill({ contentType: JAVASCRIPT_CONTENT_TYPE, body: TURNSTILE_STUB }));
  return context;
}

async function askedForCode({ page, address, authorize }: { page: Page; address: string; authorize: string }): Promise<string> {
  await page.goto(authorize);
  await expect(page.getByRole('heading', { level: 1, name: SIGN_IN_TITLE })).toBeVisible();
  await expect(page.getByLabel('Email address')).toBeFocused();
  await page.getByLabel('Email address').fill(address);
  const inbox = page.waitForResponse((response) => response.url().endsWith('/oauth/sign-in-links'));
  await page.getByRole('button', { name: 'Email me a link' }).click();
  const html = await (await inbox).text();
  await expect(page.getByRole('heading', { level: 1, name: CHECK_INBOX })).toBeVisible();
  return html;
}

test.describe('the code page of the OAuth sign-in', () => {
  test('autofocuses the email field, then the code field, and typing six digits signs in', async ({ browser }) => {
    const context = await browserContextOf(browser);
    const page = await context.newPage();
    const address = freshAddress();
    await askedForCode({ page, address, authorize: await authorizeUrl(browser) });
    await expect(page.getByLabel(CODE_LABEL)).toBeFocused();
    await expect(page.locator(BOX_SELECTOR)).toHaveCount(6);
    const code = await mailedCodeTo(address);
    await page.keyboard.type(code);
    await expect(page.getByRole('heading', { level: 1, name: CONSENT_TITLE })).toBeVisible();
    expect(page.url()).not.toContain(code);
    await context.close();
  });

  test('pasting the code anywhere on the page fills every box and signs in on its own', async ({ browser }) => {
    const context = await browserContextOf(browser);
    const page = await context.newPage();
    const address = freshAddress();
    await askedForCode({ page, address, authorize: await authorizeUrl(browser) });
    const code = await mailedCodeTo(address);
    await page.getByRole('heading', { level: 1, name: CHECK_INBOX }).click();
    await page.evaluate(PASTE_SCRIPT, `${code.slice(0, 3)} ${code.slice(3)}`);
    await expect(page.getByRole('heading', { level: 1, name: CONSENT_TITLE })).toBeVisible();
    await context.close();
  });

  test('the boxes mirror what is typed, ignore letters and step back on backspace', async ({ browser }) => {
    const context = await browserContextOf(browser);
    const page = await context.newPage();
    await askedForCode({ page, address: freshAddress(), authorize: await authorizeUrl(browser) });
    await page.keyboard.type('12a3');
    await expect(page.locator(BOX_SELECTOR)).toHaveText(['1', '2', '3', '', '', '']);
    await page.keyboard.press('Backspace');
    await expect(page.locator(BOX_SELECTOR)).toHaveText(['1', '2', '', '', '', '']);
    await expect(page.getByLabel(CODE_LABEL)).toHaveValue('12');
    await context.close();
  });

  test('a wrong code says so, shakes the field and keeps the page', async ({ browser }) => {
    const context = await browserContextOf(browser);
    const page = await context.newPage();
    await askedForCode({ page, address: freshAddress(), authorize: await authorizeUrl(browser) });
    await page.keyboard.type(WRONG_CODE);
    await expect(page.getByText(WRONG_NOTICE)).toBeVisible();
    const field = page.locator(FIELD_SELECTOR);
    await expect(field).toHaveAttribute('data-state', WRONG_STATE);
    expect(await field.evaluate((element) => getComputedStyle(element).animationName)).toBe(SHAKE_ANIMATION);
    await expect(page.getByLabel(CODE_LABEL)).toBeFocused();
    await context.close();
  });

  test('the shake gives way to a still highlight when the visitor prefers reduced motion', async ({ browser }) => {
    const context = await browserContextOf(browser);
    const page = await context.newPage();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await askedForCode({ page, address: freshAddress(), authorize: await authorizeUrl(browser) });
    await page.keyboard.type(WRONG_CODE);
    const field = page.locator(FIELD_SELECTOR);
    await expect(field).toHaveAttribute('data-state', WRONG_STATE);
    expect(await field.evaluate((element) => getComputedStyle(element).animationName)).toBe(NO_ANIMATION);
    await context.close();
  });

  test('Resend code counts down from 30 seconds and then asks again', async ({ browser }) => {
    const context = await browserContextOf(browser);
    const page = await context.newPage();
    await page.clock.install();
    await askedForCode({ page, address: freshAddress(), authorize: await authorizeUrl(browser) });
    const resend = page.getByRole('button', { name: RESEND_WAIT_LABEL });
    await expect(resend).toHaveAttribute('aria-disabled', 'true');
    await page.clock.runFor(COUNTDOWN_MS);
    const ready = page.getByRole('button', { name: RESEND_LABEL, exact: true });
    await expect(ready).not.toHaveAttribute('aria-disabled', 'true');
    await context.close();
  });

  test('works without JavaScript as a plain field with a submit button', async ({ browser }) => {
    const context = await browserContextOf(browser);
    const page = await context.newPage();
    const address = freshAddress();
    const html = await askedForCode({ page, address, authorize: await authorizeUrl(browser) });
    const challengeCookies = (await context.cookies()).filter((cookie) => cookie.name.includes('challenge'));
    const plainContext = await browser.newContext({ javaScriptEnabled: false });
    await plainContext.addCookies(challengeCookies);
    const plainPage = await plainContext.newPage();
    const fixtureUrl = `${OAUTH_ORIGIN}/code-page-fixture`;
    await plainPage.route(fixtureUrl, (route) => route.fulfill({ contentType: 'text/html', body: html }));
    await plainPage.goto(fixtureUrl);
    const field = plainPage.getByLabel(CODE_LABEL);
    await expect(field).toBeVisible();
    await expect(plainPage.locator(BOX_SELECTOR).first()).toBeHidden();
    await field.fill(await mailedCodeTo(address));
    const submit = plainPage.getByRole('button', { name: 'Sign in' });
    await expect(submit).toBeVisible();
    await submit.click({ force: true });
    await expect(plainPage.getByRole('heading', { level: 1, name: CONSENT_TITLE })).toBeVisible();
    await plainContext.close();
    await context.close();
  });
});

test.describe('the landing page', () => {
  test('focuses nothing on load', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[autofocus]')).toHaveCount(0);
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('BODY');
  });
});
