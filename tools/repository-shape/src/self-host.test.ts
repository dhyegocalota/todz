import { existsSync } from 'node:fs';
import { posix } from 'node:path';
import { describe, expect, test } from 'vitest';
import { frontMatterOf } from './front-matter';
import { capturedNames, readRepositoryFile, REPOSITORY_URL, repositoryPath } from './repository-files';

const GUIDE = 'apps/docs/self-host.mdx';
const LEGACY_GUIDE = 'docs/self-host.md';
const GUIDE_TITLE = 'Self-hosting';
const DOCS_GUIDE_URL = 'https://docs.todz.app/self-host';
const KEPT_LINK_TARGET_PATTERN = /^(?:https:\/\/|#)/;
const TITLE_HEADING_PATTERN = /^# /m;
const CODE_SPAN_PATTERN = /`[^`\n]*`/g;
const MDX_UNSAFE_PATTERN = /[<{]/;
const LINE_SEPARATOR = '\n';
const PRIVATE_REFERENCE_PATTERN = /\bADRs?\b|docs\/(?:product|adr|runbooks)|\brunbook\b|\.test\.ts/i;
const ROOT_README = 'README.md';
const ROOT_PACKAGE_FILE = 'package.json';
const API_PACKAGE_FILE = 'apps/api/package.json';
const WRANGLER_CONFIGURATION = 'apps/api/wrangler.jsonc';
const WORKER_ENVIRONMENT = 'apps/api/src/env.ts';
const APP_PROJECT = 'apps/macos/project.yml';
const VERIFY_SCRIPT = 'scripts/verify-macos.sh';
const SENDER_SOURCE = 'apps/api/src/email-sender.ts';
const BASE_URL_SETTING = 'TODZ_API_BASE_URL';
const CLAUDE_CODE_PREFIX = 'claude mcp add --transport http';
const MCP_PATH = '/mcp';
const SERVER_NAME = 'todz';
const HTTPS_PREFIX = 'https://';
const KEY_HEADER = '--header';
const DEBUG_CONFIGURATION = '-configuration Debug';
const RELEASE_CONFIGURATION = '-configuration Release';
const PNPM_BUILT_IN_COMMANDS = ['exec', 'dlx', 'install', 'add'];
const LINK_PATTERN = /\]\(([^)\s]+)\)/g;
const EXTERNAL_LINK_PATTERN = /^(https?:|mailto:|#)/;
const FENCED_BLOCK_PATTERN = /```[\s\S]*?```/g;
const PNPM_COMMAND_PATTERN = /\bpnpm ([a-z][\w:-]*)/g;
const API_SCRIPT_PATTERN = /pnpm --filter @todz\/api ([a-z][\w:-]*)/g;
const DATABASE_COMMAND_PATTERN = /wrangler d1 (?:create|migrations apply) ([\w-]+)/g;
const DATABASE_NAME_PATTERN = /"database_name": "([\w-]+)"/;
const ENVIRONMENT_NAME_PATTERN = /`(?:vars\.)?((?:PUBLIC_ORIGIN|SITE_ORIGIN|TURNSTILE_[A-Z_]+))`/g;
const ROUTE_PATTERN = /"pattern": "([^"]+)"/g;
const XCODE_LINE_PATTERN = /^(xcode(?:gen|build) .+?)(?: \\)?$/gm;
const SECRET_COMMAND_PATTERN = /wrangler secret (?:put|delete) ([A-Z_]+)/g;
const REPOSITORY_PATH_PATTERN = /`((?:apps|libs|tools|scripts|docs)\/[\w./@-]+)`/g;
const SERVER_DEPLOY_SCRIPT = 'server:deploy';
const SERVER_DEPLOY_COMMAND = 'tsx scripts/server/cli.ts';
const GUIDE_SERVER_DEPLOY = `pnpm --filter @todz/api ${SERVER_DEPLOY_SCRIPT}`;
const DEPLOY_HEADING = '## 4. Deploy';
const UPDATING_HEADING = '## Updating';
const UPDATE_ORDER_PHRASE = 'Update the server first, then the app';
const SETTINGS_PHRASE = 'open todz › Settings › Server and paste the URL the deploy printed';
const PROJECT_KEYS = [
  'DEVELOPMENT_TEAM',
  'bundleIdPrefix',
  'TODZ_APP_BUNDLE_IDENTIFIER',
  'TODZ_WIDGETS_BUNDLE_IDENTIFIER',
  'TODZ_APP_GROUP',
];
const WRANGLER_KEYS = [
  'account_id',
  'routes',
  'custom_domain',
  'PUBLIC_ORIGIN',
  'SITE_ORIGIN',
  'send_email',
  'allowed_sender_addresses',
  'd1_databases',
  'database_id',
  'ratelimits',
  'namespace_id',
];
const DEPLOY_SURFACES_PHRASE = '`workers_dev` and `preview_urls` stay `false`';
const PRODUCTION_SETTINGS = [
  { key: 'SIGN_IN_PROVIDER', configured: '"email"', phrase: '`vars.SIGN_IN_PROVIDER` stays `email`' },
  { key: 'EMAIL_SENDER', configured: '"cloudflare"', phrase: '`vars.EMAIL_SENDER` stays `cloudflare`' },
  { key: 'workers_dev', configured: 'false', phrase: DEPLOY_SURFACES_PHRASE },
  { key: 'preview_urls', configured: 'false', phrase: DEPLOY_SURFACES_PHRASE },
];
const SENDER_NAMES = ['SENDER_ADDRESS', 'REPLY_TO_ADDRESS'];
const NAMESPACE_ID_PATTERN = /"namespace_id": "(\d+)"/g;
const NAMESPACE_RANGE_PATTERN = /`(\d+)` to `(\d+)`/;
const ANCHOR_PATTERN = /#.*$/;
const NEXT_HEADING_PATTERN = /\n## /;
const NOT_FOUND = -1;
const FIRST_CAPTURE = 1;
const LAST_CAPTURE = 2;

const guide = readRepositoryFile(GUIDE);

function scriptsOf(manifest: string): string[] {
  return Object.keys(JSON.parse(readRepositoryFile(manifest)).scripts);
}

function isBrokenLink(target: string): boolean {
  return !existsSync(repositoryPath(posix.join(posix.dirname(GUIDE), target.replace(ANCHOR_PATTERN, ''))));
}

function sectionOf(heading: string): string {
  const start = guide.indexOf(heading);
  const rest = guide.slice(start + heading.length);
  const end = rest.search(NEXT_HEADING_PATTERN);
  if (end === NOT_FOUND) return rest;
  return rest.slice(0, end);
}

function captured(pattern: RegExp, text = guide): string[] {
  return capturedNames({ text, pattern });
}

describe('the self-host guide', () => {
  test('the root README links it on the docs site, not its file', () => {
    const readme = readRepositoryFile(ROOT_README);
    expect(readme).toContain(`](${DOCS_GUIDE_URL})`);
    expect(readme).not.toContain(`](${GUIDE})`);
  });

  test('is the docs site page, not a file of docs/', () => {
    expect(existsSync(repositoryPath(GUIDE))).toBe(true);
    expect(existsSync(repositoryPath(LEGACY_GUIDE))).toBe(false);
  });

  test('opens with front matter that titles it, and has no heading of its own', () => {
    expect(frontMatterOf(guide).title).toBe(GUIDE_TITLE);
    expect(TITLE_HEADING_PATTERN.test(guide)).toBe(false);
  });

  test('links only outside pages and its own anchors, never the private repository', () => {
    const targets = captured(LINK_PATTERN, guide.replace(FENCED_BLOCK_PATTERN, ''));
    expect(targets.filter((target) => !KEPT_LINK_TARGET_PATTERN.test(target))).toEqual([]);
    expect(targets.filter((target) => target.startsWith(REPOSITORY_URL))).toEqual([]);
  });

  test('holds no character MDX parses as markup outside code (pin)', () => {
    const prose = guide.replace(FENCED_BLOCK_PATTERN, '').replace(CODE_SPAN_PATTERN, '');
    expect(prose.split(LINE_SEPARATOR).filter((line) => MDX_UNSAFE_PATTERN.test(line))).toEqual([]);
  });

  test('refers to no ADR, product document, runbook or test file of the private repository', () => {
    expect(guide.split(LINE_SEPARATOR).filter((line) => PRIVATE_REFERENCE_PATTERN.test(line))).toEqual([]);
  });

  test('every relative link resolves', () => {
    const links = captured(LINK_PATTERN, guide.replace(FENCED_BLOCK_PATTERN, '')).filter((target) => !EXTERNAL_LINK_PATTERN.test(target));
    expect(links.filter(isBrokenLink)).toEqual([]);
  });

  test('every pnpm command is a script the repository has', () => {
    const rootScripts = scriptsOf(ROOT_PACKAGE_FILE);
    const apiScripts = scriptsOf(API_PACKAGE_FILE);
    const unknownRoot = captured(PNPM_COMMAND_PATTERN).filter(
      (command) => !PNPM_BUILT_IN_COMMANDS.includes(command) && !rootScripts.includes(command),
    );
    const unknownApi = captured(API_SCRIPT_PATTERN).filter(
      (command) => !PNPM_BUILT_IN_COMMANDS.includes(command) && !apiScripts.includes(command),
    );
    expect([...unknownRoot, ...unknownApi]).toEqual([]);
  });

  test('every database command names the database in the Wrangler configuration', () => {
    const databaseName = DATABASE_NAME_PATTERN.exec(readRepositoryFile(WRANGLER_CONFIGURATION))?.[FIRST_CAPTURE];
    const databases = captured(DATABASE_COMMAND_PATTERN);
    expect(databases.length).toBeGreaterThan(0);
    expect(databases.filter((name) => name !== databaseName)).toEqual([]);
  });

  test('every variable and secret it names is one the Worker reads', () => {
    const environment = readRepositoryFile(WORKER_ENVIRONMENT);
    const names = [...captured(ENVIRONMENT_NAME_PATTERN), ...captured(SECRET_COMMAND_PATTERN)];
    expect(names.length).toBeGreaterThan(0);
    expect(names.filter((name) => !new RegExp(`^\\s+${name}\\??:`, 'm').test(environment))).toEqual([]);
  });

  test('every Wrangler key it asks a fork to edit is in the configuration, and the guide names each', () => {
    const configuration = readRepositoryFile(WRANGLER_CONFIGURATION);
    expect(WRANGLER_KEYS.filter((key) => !configuration.includes(`"${key}"`))).toEqual([]);
    expect(WRANGLER_KEYS.filter((key) => !guide.includes(key))).toEqual([]);
  });

  test('it names every configured route, so a fork replaces each with its own domain', () => {
    const routes = captured(ROUTE_PATTERN, readRepositoryFile(WRANGLER_CONFIGURATION));
    expect(routes.length).toBeGreaterThan(0);
    expect(routes.filter((route) => !guide.includes(`\`${route}\``))).toEqual([]);
  });

  test('the rate-limit namespaces it names are the configured ones', () => {
    const configured = captured(NAMESPACE_ID_PATTERN, readRepositoryFile(WRANGLER_CONFIGURATION)).map(Number);
    const range = NAMESPACE_RANGE_PATTERN.exec(guide);
    expect(range).not.toBeNull();
    const named = { first: Number(range?.[FIRST_CAPTURE]), last: Number(range?.[LAST_CAPTURE]) };
    expect(configured).toEqual(Array.from({ length: named.last - named.first + 1 }, (_, offset) => named.first + offset));
  });

  test('the production settings it says to keep are the configured ones', () => {
    const configuration = readRepositoryFile(WRANGLER_CONFIGURATION);
    const unconfigured = PRODUCTION_SETTINGS.filter(({ key, configured }) => !configuration.includes(`"${key}": ${configured}`));
    const unnamed = PRODUCTION_SETTINGS.filter(({ phrase }) => !guide.includes(phrase));
    expect([...unconfigured, ...unnamed]).toEqual([]);
  });

  test('the app build setting and the build commands are the repository own', () => {
    const verifyScript = readRepositoryFile(VERIFY_SCRIPT);
    const guideLines = captured(XCODE_LINE_PATTERN).map((line) => line.replace(RELEASE_CONFIGURATION, DEBUG_CONFIGURATION));
    expect(readRepositoryFile(APP_PROJECT)).toContain(`${BASE_URL_SETTING}:`);
    expect(guideLines.length).toBeGreaterThan(0);
    expect(guideLines.filter((line) => !verifyScript.includes(line))).toEqual([]);
  });

  test('the deploy step and the Updating section deploy with the script that prints the URL to paste, which stamps the version and wraps wrangler deploy', () => {
    expect(sectionOf(DEPLOY_HEADING)).toContain(GUIDE_SERVER_DEPLOY);
    expect(sectionOf(UPDATING_HEADING)).toContain(GUIDE_SERVER_DEPLOY);
    expect(JSON.parse(readRepositoryFile(API_PACKAGE_FILE)).scripts[SERVER_DEPLOY_SCRIPT]).toBe(SERVER_DEPLOY_COMMAND);
  });

  test('it never asks a fork to rebuild the app for its server, and says to paste the URL in Settings', () => {
    expect(guide).not.toContain(BASE_URL_SETTING);
    expect(guide).toContain(SETTINGS_PHRASE);
  });

  test('the Updating section updates the server before the app', () => {
    const updating = sectionOf(UPDATING_HEADING);
    expect(updating).toContain(UPDATE_ORDER_PHRASE);
    expect(updating.indexOf(UPDATE_ORDER_PHRASE)).toBeLessThan(updating.indexOf(GUIDE_SERVER_DEPLOY));
  });

  test('the Claude Code command is the OAuth one: the address alone, with no key header', () => {
    expect(guide).toContain(`${CLAUDE_CODE_PREFIX} ${SERVER_NAME} ${HTTPS_PREFIX}`);
    expect(guide).toContain(MCP_PATH);
    expect(guide).not.toContain(KEY_HEADER);
  });

  test('every repository path it names exists', () => {
    const paths = captured(REPOSITORY_PATH_PATTERN);
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.filter((path) => !existsSync(repositoryPath(path)))).toEqual([]);
  });

  test('every app setting it asks a fork to change is in the app project, and the guide names each', () => {
    const project = readRepositoryFile(APP_PROJECT);
    expect(PROJECT_KEYS.filter((key) => !project.includes(`${key}:`))).toEqual([]);
    expect(PROJECT_KEYS.filter((key) => !guide.includes(`\`${key}\``))).toEqual([]);
  });

  test('the sender it asks to change lives where it says', () => {
    const source = readRepositoryFile(SENDER_SOURCE);
    expect(guide).toContain(`\`${SENDER_SOURCE}\``);
    expect(SENDER_NAMES.filter((name) => !source.includes(`const ${name}`) || !guide.includes(`\`${name}\``))).toEqual([]);
  });
});
