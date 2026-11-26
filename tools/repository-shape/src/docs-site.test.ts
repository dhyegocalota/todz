import { existsSync } from 'node:fs';
import { posix } from 'node:path';
import { describe, expect, test } from 'vitest';
import { bodyOf, frontMatterOf } from './front-matter';
import { capturedNames, readRepositoryFile, repositoryFiles, repositoryPath } from './repository-files';

const DOCS_DIRECTORY = 'apps/docs';
const DOCS_CONFIGURATION = 'apps/docs/docs.json';
const DOCS_MANIFEST = 'apps/docs/package.json';
const SITE_STYLE = 'apps/api/src/site/site-style.ts';
const LANDING_COPY = 'apps/api/src/site/landing-copy.ts';
const COMPANY_CONSTANTS = 'libs/types/src/constants.ts';
const WRANGLER_CONFIGURATION = 'apps/api/wrangler.jsonc';
const BRAND_ICON = 'docs/brand/todz-icon.svg';
const FAVICON = 'apps/docs/favicon.svg';
const PAGE_EXTENSION = '.mdx';
const NAVIGATION_GROUPS = [
  { group: 'Get started', pages: ['index', 'quickstart', 'install-on-mac', 'workspaces', 'connect-an-agent'] },
  { group: 'Reference', pages: ['mcp-tools'] },
  { group: 'Self-host', pages: ['self-host'] },
  { group: 'About', pages: ['privacy', 'open-source'] },
];
const NOT_FOUND_TITLE = 'Page not found';
const HOME_LINK = '](/)';
const HOME_PATH = '/';
const DOCS_THEME = 'mint';
const DOCS_APPEARANCE = 'system';
const WORDMARK = 'todz';
const SCHEME_COUNT = 2;
const FIRST_CAPTURE = 1;
const GRADIENT_STOP_PATTERN = /<stop [^>]*stop-color="(#[0-9A-Fa-f]{6})"/g;
const ICON_PATH_PATTERN = / d="([^"]+)"/g;
const CREDIT_LEAD_PATTERN = /creditLead: '([^']+)'/;
const TRADE_NAME_PATTERN = /tradeName: '([^']+)'/;
const WEBSITE_PATTERN = /website: '([^']+)'/;
const SITE_ORIGIN_PATTERN = /"SITE_ORIGIN": "([^"]+)"/;
const FENCED_BLOCK_PATTERN = /```[\s\S]*?```/g;
const TITLE_HEADING_PATTERN = /^# /m;
const MINT_IGNORE = 'apps/docs/.mintignore';
const MINT_IGNORED_ENTRIES = ['README.md', 'e2e', 'test-results', 'node_modules'];
const MARKDOWN_PATTERN = /\.mdx?$/;
const LINE_SEPARATOR = '\n';
const EXACT_VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const MINT_PACKAGE = 'mint';
const MINT_SCRIPT_NAMES = ['dev', 'broken-links', 'validate'];
const MINT_COMMAND_PATTERN = /^mint /;
const DLX_COMMAND = 'dlx';
const CLIENT_VERSION_FLAG = '--client-version';
const PLAYWRIGHT_CONFIGURATION = 'apps/docs/playwright.config.ts';
const DOCS_PORT_SOURCE = 'apps/docs/e2e/support/docs-port.ts';
const DOCS_PORT_CALL = 'await docsPortOf()';
const DOCS_PORT_DECLARATION = "DOCS_PORT_VARIABLE = 'TODZ_DOCS_PORT'";
const DOCS_PORT_READ = 'process.env[DOCS_PORT_VARIABLE]';
const FREE_PORT_CALL = 'await freePort()';
const DOCS_PORT_WRITE = 'process.env[DOCS_PORT_VARIABLE] = ';
const LITERAL_PORT_PATTERN = /(?:--port|localhost:)\s*\d/;
const SCRATCH_SPEC_IGNORE = 'testIgnore: IGNORED_SPECS_PATTERN';

type Scheme = 'light' | 'dark';

type DocsConfiguration = {
  theme?: string;
  appearance?: { default?: string };
  favicon?: string;
  logo?: { light?: string; dark?: string; href?: string };
  colors?: { primary?: string; light?: string; dark?: string };
  background?: { color?: { light?: string; dark?: string } };
  navbar?: { links?: { label: string; href: string }[] };
  footer?: { links?: { header: string; items: { label: string; href: string }[] }[] };
  errors?: { '404'?: { redirect?: boolean; title?: string; description?: string } };
  navigation?: { groups?: { group: string; pages: string[] }[] };
};

const configuration = JSON.parse(readRepositoryFile(DOCS_CONFIGURATION)) as DocsConfiguration;

function tokenOf({ name, scheme }: { name: string; scheme: Scheme }): string {
  const pattern = new RegExp(`--color-${name}:(#[0-9A-Fa-f]{6})`, 'g');
  const values = capturedNames({ text: readRepositoryFile(SITE_STYLE), pattern });
  expect(values).toHaveLength(SCHEME_COUNT);
  return values[scheme === 'light' ? 0 : 1]!;
}

function singleCapture({ text, pattern }: { text: string; pattern: RegExp }): string {
  const match = pattern.exec(text);
  expect(match).not.toBeNull();
  return match![FIRST_CAPTURE]!;
}

function pagePaths(): string[] {
  return repositoryFiles(DOCS_DIRECTORY).filter((path) => path.endsWith(PAGE_EXTENSION));
}

function pageName(path: string): string {
  return posix.relative(DOCS_DIRECTORY, path).slice(0, -PAGE_EXTENSION.length);
}

function navigationPages(): string[] {
  const groups = configuration.navigation?.groups;
  expect(groups).toBeDefined();
  return groups!.flatMap((group) => group.pages);
}

function isMissingFile(path: string | undefined): boolean {
  return path === undefined || !existsSync(repositoryPath(posix.join(DOCS_DIRECTORY, path)));
}

describe('docs.json', () => {
  test('uses the mint theme and follows the system appearance', () => {
    expect(configuration.theme).toBe(DOCS_THEME);
    expect(configuration.appearance?.default).toBe(DOCS_APPEARANCE);
  });

  test('wears the landing accent in light and dark, and its page colour as the background', () => {
    const accent = { light: tokenOf({ name: 'accent', scheme: 'light' }), dark: tokenOf({ name: 'accent', scheme: 'dark' }) };
    const page = { light: tokenOf({ name: 'page', scheme: 'light' }), dark: tokenOf({ name: 'page', scheme: 'dark' }) };
    expect(configuration.colors).toEqual({ primary: accent.light, dark: accent.light, light: accent.dark });
    expect(configuration.background?.color).toEqual(page);
  });

  test('names a logo for each scheme and a favicon that exist', () => {
    expect(configuration.logo?.href).toBe(HOME_PATH);
    expect([configuration.logo?.light, configuration.logo?.dark, configuration.favicon].filter(isMissingFile)).toEqual([]);
  });

  test('the favicon is a byte copy of the brand icon', () => {
    expect(readRepositoryFile(FAVICON)).toBe(readRepositoryFile(BRAND_ICON));
  });

  test.each<Scheme>(['light', 'dark'])(
    'the %s logo holds the icon gradient and paths and the wordmark in the landing text colour',
    (scheme) => {
      const icon = readRepositoryFile(BRAND_ICON);
      const logoPath = configuration.logo?.[scheme];
      expect(logoPath).toBeDefined();
      const logo = readRepositoryFile(posix.join(DOCS_DIRECTORY, logoPath!));
      const iconPieces = [
        ...capturedNames({ text: icon, pattern: GRADIENT_STOP_PATTERN }),
        ...capturedNames({ text: icon, pattern: ICON_PATH_PATTERN }),
      ];
      expect(iconPieces.length).toBeGreaterThan(0);
      expect(iconPieces.filter((piece) => !logo.includes(piece))).toEqual([]);
      expect(logo).toMatch(new RegExp(`<text[^>]*fill="${tokenOf({ name: 'text', scheme })}"[^>]*>${WORDMARK}</text>`));
    },
  );

  test('credits Logic Bit in one footer column: the lead of the landing credit as its header, the company name as its one link', () => {
    const copy = readRepositoryFile(LANDING_COPY);
    const constants = readRepositoryFile(COMPANY_CONSTANTS);
    const tradeName = singleCapture({ text: constants, pattern: TRADE_NAME_PATTERN });
    const creditLead = singleCapture({ text: copy, pattern: CREDIT_LEAD_PATTERN });
    const website = singleCapture({ text: constants, pattern: WEBSITE_PATTERN });
    expect(configuration.footer?.links).toEqual([{ header: creditLead, items: [{ label: tradeName, href: website }] }]);
  });

  test('links the landing from the navbar', () => {
    const siteOrigin = singleCapture({ text: readRepositoryFile(WRANGLER_CONFIGURATION), pattern: SITE_ORIGIN_PATTERN });
    expect(configuration.navbar?.links).toEqual([{ label: new URL(siteOrigin).host, href: siteOrigin }]);
  });

  test('answers a missing page with its own page that links back to the introduction', () => {
    expect(configuration.errors?.['404']?.redirect).toBe(false);
    expect(configuration.errors?.['404']?.title).toBe(NOT_FOUND_TITLE);
    expect(configuration.errors?.['404']?.description).toContain(HOME_LINK);
  });

  test('lists the pages in their groups, in order', () => {
    expect(configuration.navigation?.groups).toEqual(NAVIGATION_GROUPS);
  });
});

describe('the pages', () => {
  test('every page on disk is in the navigation, and every page of the navigation is on disk', () => {
    expect(pagePaths().map(pageName).sort()).toEqual([...navigationPages()].sort());
  });

  test('every Markdown file under apps/docs is a page of the navigation or ignored by .mintignore', () => {
    const ignored = readRepositoryFile(MINT_IGNORE).split(LINE_SEPARATOR).filter(Boolean);
    const isIgnored = (path: string): boolean => ignored.some((entry) => path === entry || path.startsWith(`${entry}/`));
    const pages = navigationPages().map((name) => `${name}${PAGE_EXTENSION}`);
    const unreachable = repositoryFiles(DOCS_DIRECTORY)
      .map((path) => posix.relative(DOCS_DIRECTORY, path))
      .filter((path) => MARKDOWN_PATTERN.test(path) && !pages.includes(path) && !isIgnored(path));
    expect(unreachable).toEqual([]);
  });

  test('.mintignore lists the files Mintlify must not publish', () => {
    expect(readRepositoryFile(MINT_IGNORE).split(LINE_SEPARATOR).filter(Boolean)).toEqual(MINT_IGNORED_ENTRIES);
  });

  test('every page has a front matter title and no heading of its own', () => {
    const pages = pagePaths().map((path) => ({ path, text: readRepositoryFile(path) }));
    expect(pages.filter(({ text }) => !frontMatterOf(text).title)).toEqual([]);
    expect(pages.filter(({ text }) => TITLE_HEADING_PATTERN.test(bodyOf(text).replace(FENCED_BLOCK_PATTERN, '')))).toEqual([]);
  });
});

describe('the package', () => {
  test('installs Mintlify as one exact-pinned dev dependency that every script calls directly, and pins the client for the preview', () => {
    const manifest = JSON.parse(readRepositoryFile(DOCS_MANIFEST)) as {
      scripts: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    const mintScripts = MINT_SCRIPT_NAMES.map((name) => manifest.scripts[name]!);
    expect(manifest.devDependencies[MINT_PACKAGE]).toMatch(EXACT_VERSION_PATTERN);
    expect(mintScripts.filter((script) => !MINT_COMMAND_PATTERN.test(script) || script.includes(DLX_COMMAND))).toEqual([]);
    expect(manifest.scripts.dev).toContain(CLIENT_VERSION_FLAG);
  });

  test('the walk takes its port only from docsPortOf, which reads TODZ_DOCS_PORT before choosing a free one and writes the choice back (pin)', () => {
    const configuration = readRepositoryFile(PLAYWRIGHT_CONFIGURATION);
    const portSource = readRepositoryFile(DOCS_PORT_SOURCE);
    expect(configuration).toContain(DOCS_PORT_CALL);
    expect(configuration.match(LITERAL_PORT_PATTERN)).toBeNull();
    expect(portSource).toContain(DOCS_PORT_DECLARATION);
    expect(portSource.indexOf(DOCS_PORT_READ)).toBeLessThan(portSource.indexOf(FREE_PORT_CALL));
    expect(portSource).toContain(DOCS_PORT_WRITE);
  });

  test('the walk ignores scratch specs (pin)', () => {
    expect(readRepositoryFile(PLAYWRIGHT_CONFIGURATION)).toContain(SCRATCH_SPEC_IGNORE);
  });
});
