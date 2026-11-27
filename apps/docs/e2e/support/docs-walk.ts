import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test as base, expect } from '@playwright/test';

export { expect };

export enum DocsViewport {
  Desktop = 'desktop',
  Narrow = 'narrow',
}

export enum ColorScheme {
  Light = 'light',
  Dark = 'dark',
}

const DOCS_DIRECTORY = resolve(import.meta.dirname, '..', '..');
const INDEX_PAGE = 'index';
const ENGLISH_LANGUAGE = 'en';
const ERROR_CONSOLE_TYPE = 'error';
const STATUS_CLIENT_ERROR_FROM = 400;
const TITLE_PATTERN = /^title: (.+)$/m;
const PATTERN_SPECIAL_CHARACTERS = /[.*+?^${}()|[\]\\]/g;
const FIRST_CAPTURE = 1;

export const WALK_NOISE_ALLOWLIST: { patternOf: (input: { origin: string }) => RegExp; reason: string }[] = [
  {
    patternOf: () => /^requestfailed .*\/socket\.io\//,
    reason: 'mint dev holds a live-reload polling request open and the browser aborts it on every navigation',
  },
  {
    patternOf: ({ origin }) => new RegExp(`^requestfailed ${escapedForPattern(origin)}/_mintlify/api/user net::ERR_ABORTED$`),
    reason: 'mint dev asks its preview for the signed-in user and the browser aborts that request when the walk navigates away first',
  },
  {
    patternOf: ({ origin }) => new RegExp(`^requestfailed ${escapedForPattern(origin)}/_mintlify/assets/\\S+\\.js net::ERR_ABORTED$`),
    reason: 'mint dev serves lazily loaded chunks from its own assets path and the browser aborts one when the walk navigates first',
  },
];

export type DocsPage = { name: string; path: string; title: string };

type DocsConfiguration = { navigation: { languages: { language: string; groups: { pages: string[] }[] }[] } };

function escapedForPattern(text: string): string {
  return text.replace(PATTERN_SPECIAL_CHARACTERS, '\\$&');
}

export function docsPages(): DocsPage[] {
  const configuration = JSON.parse(readFileSync(resolve(DOCS_DIRECTORY, 'docs.json'), 'utf8')) as DocsConfiguration;
  const englishEntry = configuration.navigation.languages.find((entry) => entry.language === ENGLISH_LANGUAGE);
  if (englishEntry === undefined) throw new Error('docs.json has no English entry');
  return englishEntry.groups
    .flatMap((group) => group.pages)
    .map((name) => {
      const title = TITLE_PATTERN.exec(readFileSync(resolve(DOCS_DIRECTORY, `${name}.mdx`), 'utf8'))?.[FIRST_CAPTURE];
      if (title === undefined) throw new Error(`${name} has no front matter title`);
      return { name, path: name === INDEX_PAGE ? '/' : `/${name}`, title };
    });
}

function isAllowedNoise({ entry, origin }: { entry: string; origin: string }): boolean {
  return WALK_NOISE_ALLOWLIST.some((allowed) => allowed.patternOf({ origin }).test(entry));
}

export const test = base.extend<{ missingPath: string | null; walkNoise: void }>({
  missingPath: [null, { option: true }],
  walkNoise: [
    async ({ page, baseURL, missingPath }, use) => {
      if (baseURL === undefined) throw new Error('the walk has no base URL');
      const origin = new URL(baseURL).origin;
      const missingAddress = missingPath === null ? null : `${origin}${missingPath}`;
      const entries: string[] = [];
      page.on('console', (message) => {
        if (message.type() !== ERROR_CONSOLE_TYPE) return;
        entries.push(`console.error ${message.text()} @ ${message.location().url}`);
      });
      page.on('pageerror', (error) => entries.push(`pageerror ${error.message}`));
      page.on('requestfailed', (request) => entries.push(`requestfailed ${request.url()} ${request.failure()?.errorText}`));
      page.on('response', (response) => {
        if (response.status() < STATUS_CLIENT_ERROR_FROM) return;
        entries.push(`status ${response.status()} ${response.url()}`);
      });
      await use();
      const isMissingDocument = (entry: string): boolean => missingAddress !== null && entry.endsWith(missingAddress);
      expect(entries.filter((entry) => !isAllowedNoise({ entry, origin }) && !isMissingDocument(entry))).toEqual([]);
    },
    { auto: true },
  ],
});
