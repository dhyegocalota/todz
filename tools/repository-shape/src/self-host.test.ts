import { existsSync } from 'node:fs';
import { posix } from 'node:path';
import { describe, expect, test } from 'vitest';
import { capturedNames, readRepositoryFile, repositoryPath } from './repository-files';

const GUIDE = 'docs/self-host.md';
const ROOT_README = 'README.md';
const ROOT_PACKAGE_FILE = 'package.json';
const API_PACKAGE_FILE = 'apps/api/package.json';
const WRANGLER_CONFIGURATION = 'apps/api/wrangler.jsonc';
const WORKER_ENVIRONMENT = 'apps/api/src/env.ts';
const APP_PROJECT = 'apps/macos/project.yml';
const VERIFY_SCRIPT = 'scripts/verify.sh';
const AGENT_COMMAND = 'apps/macos/TodzKit/Sources/TodzKit/AgentCommand.swift';
const SENDER_SOURCE = 'apps/api/src/email-sender.ts';
const BASE_URL_SETTING = 'TODZ_API_BASE_URL';
const CLAUDE_CODE_PREFIX = 'claude mcp add --transport http';
const MCP_PATH = '/mcp';
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
const ENVIRONMENT_NAME_PATTERN = /`(?:vars\.)?((?:PUBLIC_ORIGIN|TURNSTILE_[A-Z_]+))`/g;
const XCODE_LINE_PATTERN = /^(xcode(?:gen|build) .+?)(?: \\)?$/gm;
const SECRET_COMMAND_PATTERN = /wrangler secret (?:put|delete) ([A-Z_]+)/g;
const REPOSITORY_PATH_PATTERN = /`((?:apps|libs|tools|scripts|docs)\/[\w./@-]+)`/g;
const PROJECT_KEYS = [
  'TODZ_API_BASE_URL',
  'DEVELOPMENT_TEAM',
  'bundleIdPrefix',
  'TODZ_APP_BUNDLE_IDENTIFIER',
  'TODZ_WIDGETS_BUNDLE_IDENTIFIER',
  'TODZ_APP_GROUP',
];
const SERVER_NAME_PATTERN = /private let serverName = "([\w-]+)"/;
const ANCHOR_SEPARATOR = '#';
const FIRST_CAPTURE = 1;

const guide = readRepositoryFile(GUIDE);

function scriptsOf(manifest: string): string[] {
  return Object.keys(JSON.parse(readRepositoryFile(manifest)).scripts);
}

function isBrokenLink(target: string): boolean {
  const [path] = target.split(ANCHOR_SEPARATOR);
  return !existsSync(repositoryPath(posix.join(posix.dirname(GUIDE), path!)));
}

function captured(pattern: RegExp, text = guide): string[] {
  return capturedNames({ text, pattern });
}

describe('the self-host guide', () => {
  test('the root README links it', () => {
    expect(readRepositoryFile(ROOT_README)).toContain(`](${GUIDE})`);
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
    expect(names.filter((name) => !environment.includes(`${name}?:`) && !environment.includes(`${name}:`))).toEqual([]);
  });

  test('the app build setting and the build commands are the repository own', () => {
    const verifyScript = readRepositoryFile(VERIFY_SCRIPT);
    const guideLines = captured(XCODE_LINE_PATTERN).map((line) => line.replace(RELEASE_CONFIGURATION, DEBUG_CONFIGURATION));
    expect(readRepositoryFile(APP_PROJECT)).toContain(`${BASE_URL_SETTING}:`);
    expect(guideLines.length).toBeGreaterThan(0);
    expect(guideLines.filter((line) => !verifyScript.includes(line))).toEqual([]);
  });

  test('the Claude Code command has the shape the key screen copies', () => {
    const serverName = SERVER_NAME_PATTERN.exec(readRepositoryFile(AGENT_COMMAND))?.[FIRST_CAPTURE];
    expect(readRepositoryFile(AGENT_COMMAND)).toContain(CLAUDE_CODE_PREFIX);
    expect(guide).toContain(`${CLAUDE_CODE_PREFIX} ${serverName} '`);
    expect(guide).toContain(`${MCP_PATH}'`);
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
    expect(guide).toContain(`\`${SENDER_SOURCE}\``);
    expect(existsSync(repositoryPath(SENDER_SOURCE))).toBe(true);
  });
});
