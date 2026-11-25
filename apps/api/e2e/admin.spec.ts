import fs from 'node:fs';
import path from 'node:path';
import { type Browser, type BrowserContext, type Page, expect, test } from '@playwright/test';
import { PERSIST_FOLDER_VARIABLE } from './persist-folder';
import { ADMIN_ADDRESS, SERVER_LOG_FILE_NAME } from './site-environment';
import { JAVASCRIPT_CONTENT_TYPE, TURNSTILE_SCRIPT_URL, TURNSTILE_STUB } from './turnstile-stub';

enum AdminPath {
  Panel = '/admin',
  Export = '/admin/export.csv',
}

const OTHER_ADDRESS = 'someone.else@example.com';
const MAIL_PAGE_URL = 'http://mail.test/';
const HTML_CONTENT_TYPE = 'text/html';
const MAILED_LINK_PATTERN = /https?:\/\/[^\s)\]]+\/admin\/sign-in#token=[A-Za-z0-9_-]{43}/;
const LOGGED_MESSAGE_START = '{"to":';
const SIGN_IN_TITLE = 'Sign in to the admin';
const INBOX_TITLE = 'Check your inbox';
const REFUSED_TITLE = "This link can't be used.";
const PANEL_TITLE = 'Waitlist';
const STAT_LABELS = ['On the list', 'Last 24 hours', 'Failed confirmations'];
const DOWNLOAD_LABEL = 'Download CSV';
const SIGN_OUT_LABEL = 'Sign out';
const GET_NEW_LINK_LABEL = 'Get a new link';
const CSV_FILE_NAME = 'todz-waitlist.csv';
const CSV_HEADER = '"address","joined_at","confirmation"';
const LINK_POLL_TIMEOUT_MS = 15_000;

type MailedMessage = { to: string; text: string };

let adminContext: BrowserContext;
let adminPage: Page;
let mailedLink: string;

function serverLogPath(): string {
  const persistFolder = process.env[PERSIST_FOLDER_VARIABLE];
  if (persistFolder === undefined) throw new Error('the Playwright configuration did not create the persist folder');
  return path.join(persistFolder, SERVER_LOG_FILE_NAME);
}

function loggedMessages(): MailedMessage[] {
  return fs
    .readFileSync(serverLogPath(), 'utf8')
    .split('\n')
    .filter((line) => line.includes(LOGGED_MESSAGE_START))
    .map((line) => JSON.parse(line.slice(line.indexOf(LOGGED_MESSAGE_START))) as MailedMessage);
}

function messagesTo(address: string): MailedMessage[] {
  return loggedMessages().filter((message) => message.to === address);
}

function mailedLinkTo(address: string): string {
  const [message] = messagesTo(address);
  if (message === undefined) throw new Error(`no mail was logged for ${address}`);
  const link = MAILED_LINK_PATTERN.exec(message.text)?.[0];
  if (link === undefined) throw new Error('the mail holds no sign-in link');
  return link;
}

async function newContextWithTurnstile({ browser, baseURL }: { browser: Browser; baseURL: string | undefined }): Promise<BrowserContext> {
  const context = await browser.newContext({ baseURL });
  await context.route(TURNSTILE_SCRIPT_URL, (route) => route.fulfill({ contentType: JAVASCRIPT_CONTENT_TYPE, body: TURNSTILE_STUB }));
  return context;
}

async function askForLink({ page, address }: { page: Page; address: string }): Promise<void> {
  await page.goto(AdminPath.Panel);
  await expect(page.getByRole('heading', { level: 1, name: SIGN_IN_TITLE })).toBeVisible();
  await page.getByLabel('Email address').fill(address);
  await page.getByRole('button', { name: 'Email me a link' }).click();
  await expect(page.getByRole('heading', { level: 1, name: INBOX_TITLE })).toBeFocused();
}

async function openFromMailPage({ context, link }: { context: BrowserContext; link: string }): Promise<Page> {
  const mailPage = await context.newPage();
  await mailPage.route(MAIL_PAGE_URL, (route) => route.fulfill({ contentType: HTML_CONTENT_TYPE, body: `<a href="${link}">Sign in</a>` }));
  await mailPage.goto(MAIL_PAGE_URL);
  await mailPage.getByRole('link', { name: 'Sign in' }).click();
  return mailPage;
}

test.describe.configure({ mode: 'serial' });

test.describe('the admin walk', () => {
  test.beforeAll(async ({ browser, baseURL }) => {
    adminContext = await newContextWithTurnstile({ browser, baseURL });
    adminPage = await adminContext.newPage();
  });

  test.afterAll(async () => {
    await adminContext.close();
  });

  test('another address gets the same card and no mail is logged for it', async () => {
    await askForLink({ page: adminPage, address: OTHER_ADDRESS });
    await expect(adminPage.getByText('If that address can sign in, a link is on its way.')).toBeVisible();
  });

  test('the admin asks for a link, gets the same card and one mail with the link', async () => {
    await askForLink({ page: adminPage, address: ADMIN_ADDRESS });
    await expect.poll(() => messagesTo(ADMIN_ADDRESS).length, { timeout: LINK_POLL_TIMEOUT_MS }).toBe(1);
    mailedLink = mailedLinkTo(ADMIN_ADDRESS);
    expect(messagesTo(OTHER_ADDRESS)).toEqual([]);
  });

  test('the mailed link opened in a fresh browser is refused and offers a new one', async ({ browser, baseURL }) => {
    const freshContext = await newContextWithTurnstile({ browser, baseURL });
    const mailPage = await openFromMailPage({ context: freshContext, link: mailedLink });
    await expect(mailPage.getByRole('heading', { level: 1, name: REFUSED_TITLE })).toBeVisible();
    await expect(mailPage.getByRole('link', { name: GET_NEW_LINK_LABEL })).toBeVisible();
    expect(mailPage.url()).not.toContain('token=');
    await freshContext.close();
  });

  test('the same link opened in the browser that asked lands on the panel', async () => {
    const mailPage = await openFromMailPage({ context: adminContext, link: mailedLink });
    await expect(mailPage).toHaveURL(new RegExp(`${AdminPath.Panel}$`));
    await expect(mailPage.getByRole('heading', { level: 1, name: PANEL_TITLE })).toBeVisible();
    expect(mailPage.url()).not.toContain('token=');
    adminPage = mailPage;
  });

  test('the panel shows the three counts and the two actions', async () => {
    await Promise.all(STAT_LABELS.map((label) => expect(adminPage.getByText(label, { exact: true })).toBeVisible()));
    await expect(adminPage.getByRole('link', { name: DOWNLOAD_LABEL })).toBeVisible();
    await expect(adminPage.getByRole('button', { name: SIGN_OUT_LABEL })).toBeVisible();
  });

  test('Download CSV saves every row under its file name, starting with the header', async () => {
    const downloading = adminPage.waitForEvent('download');
    await adminPage.getByRole('link', { name: DOWNLOAD_LABEL }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toBe(CSV_FILE_NAME);
    const csv = fs.readFileSync(await download.path(), 'utf8');
    expect(csv.startsWith(`${CSV_HEADER}\r\n`)).toBe(true);
  });

  test('Sign out returns to the sign-in card and closes the export', async () => {
    await adminPage.getByRole('button', { name: SIGN_OUT_LABEL }).click();
    await expect(adminPage).toHaveURL(new RegExp(`${AdminPath.Panel}$`));
    await expect(adminPage.getByRole('heading', { level: 1, name: SIGN_IN_TITLE })).toBeVisible();
    await adminPage.goto(AdminPath.Export);
    await expect(adminPage).toHaveURL(new RegExp(`${AdminPath.Panel}$`));
    await expect(adminPage.getByRole('heading', { level: 1, name: SIGN_IN_TITLE })).toBeVisible();
  });
});
