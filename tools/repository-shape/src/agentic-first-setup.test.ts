import { existsSync } from 'node:fs';
import { posix } from 'node:path';
import { describe, expect, test } from 'vitest';
import { DOCS_DIRECTORY, DOCS_FOLDER_OF, PAGE_EXTENSION, TRANSLATED_LANGUAGES } from './docs-languages';
import { bodyOf } from './front-matter';
import { readRepositoryFile, repositoryPath } from './repository-files';

const RAW_ORIGIN = 'https://raw.githubusercontent.com/dhyegocalota/todz/main/';
const DOCS_ORIGIN = 'https://docs.todz.app/';
const SELF_HOST_RUNBOOK = 'docs/runbooks/self-host-with-an-agent.md';
const DEVELOPMENT_RUNBOOK = 'docs/runbooks/set-up-for-development.md';
const SELF_HOST_PROMPT = `Self-host todz: follow ${RAW_ORIGIN}${SELF_HOST_RUNBOOK} end to end on my Cloudflare account, and stop only to ask me for logins, payments and secrets.`;
const DEVELOPMENT_PROMPT = `Set up todz for development: follow ${RAW_ORIGIN}${DEVELOPMENT_RUNBOOK} until pnpm verify is green, and stop only to ask me for logins.`;
const ROOT_README = 'README.md';
const CONTRIBUTING = '.github/CONTRIBUTING.md';
const SELF_HOST_PAGE = 'self-host';
const INSTALL_HEADING = '\n## Install\n';
const CONTRIBUTING_HEADING = '\n## Contributing\n';
const URL_PATTERN = /https:\/\/\S+?\.(?:md|mdx)(?=\s)/;
const FENCED_BLOCK_PATTERN = /```[\s\S]*?```/g;
const DETAILS_SUMMARY = '<summary>Do it by hand</summary>';
const DETAILS_OPENING = '<details>';
const DETAILS_CLOSING = '</details>';
const ACCORDION_OPENING = '<Accordion title="Do it by hand">';
const ACCORDION_PATTERN = /<Accordion /g;
const ACCORDION_CLOSING = '</Accordion>';
const MAX_PROMPT_LINES = 2;
const LINE_SEPARATOR = '\n';
const NOT_FOUND = -1;
const DOCTOR_COMMAND = 'bash .agents/hooks/doctor.sh';
const INSTALL_COMMAND = 'pnpm install --frozen-lockfile';
const VERIFY_COMMAND = 'pnpm verify';
const WHOAMI_COMMAND = 'wrangler whoami';
const MIGRATIONS_COMMAND = 'wrangler d1 migrations apply todz-directory --remote';
const DEPLOY_COMMAND = 'pnpm --filter @todz/api server:deploy';
const DEPLOY_WITH_VARIABLE_PATTERN = /wrangler deploy|--var/;

function pageOf({ folder }: { folder: string }): string {
  return posix.join(DOCS_DIRECTORY, folder, `${SELF_HOST_PAGE}${PAGE_EXTENSION}`);
}

const SELF_HOST_PAGES = [pageOf({ folder: '' }), ...TRANSLATED_LANGUAGES.map((language) => pageOf({ folder: DOCS_FOLDER_OF[language] }))];

function firstBlockAfter({ text, marker }: { text: string; marker: string }): string {
  const markerIndex = marker === '' ? 0 : text.indexOf(marker);
  if (markerIndex === NOT_FOUND) throw new Error(`no ${marker.trim()} heading`);
  const match = text.slice(markerIndex).match(FENCED_BLOCK_PATTERN);
  if (!match) throw new Error(`no fenced block after ${marker.trim() || 'the top'}`);
  return match[0];
}

function promptBlockOf(prompt: string): string {
  return ['```text', prompt, '```'].join(LINE_SEPARATOR);
}

function promptTargetPath(prompt: string): string {
  const match = URL_PATTERN.exec(prompt);
  if (!match) throw new Error('the prompt names no address');
  const address = match[0];
  if (address.startsWith(RAW_ORIGIN)) return address.slice(RAW_ORIGIN.length);
  if (address.startsWith(DOCS_ORIGIN))
    return posix.join(DOCS_DIRECTORY, `${address.slice(DOCS_ORIGIN.length).replace(/\.md$/, '')}${PAGE_EXTENSION}`);
  throw new Error(`the prompt points outside the repository and its docs: ${address}`);
}

function runbookOf(path: string): string {
  return readRepositoryFile(path);
}

describe('the setup prompts', () => {
  test.each([SELF_HOST_PROMPT, DEVELOPMENT_PROMPT])('%s fits in one or two lines and names an address that resolves', (prompt) => {
    expect(prompt.split(LINE_SEPARATOR).length).toBeLessThanOrEqual(MAX_PROMPT_LINES);
    expect(existsSync(repositoryPath(promptTargetPath(prompt)))).toBe(true);
  });

  test('an address into the repository that does not exist is reported', () => {
    expect(existsSync(repositoryPath(promptTargetPath(`Do it: follow ${RAW_ORIGIN}docs/runbooks/no-such-runbook.md now`)))).toBe(false);
  });

  test('an address outside the repository and its docs is refused', () => {
    expect(() => promptTargetPath('Do it: follow https://example.com/runbook.md now')).toThrow('points outside');
  });
});

describe('the root README', () => {
  const readme = readRepositoryFile(ROOT_README);

  test('opens the install part with the self-host prompt and the contributing part with the development prompt', () => {
    expect(firstBlockAfter({ text: readme, marker: INSTALL_HEADING })).toBe(promptBlockOf(SELF_HOST_PROMPT));
    expect(firstBlockAfter({ text: readme, marker: CONTRIBUTING_HEADING })).toBe(promptBlockOf(DEVELOPMENT_PROMPT));
  });

  test('keeps each way by hand in one collapsed section, never two openings left unclosed', () => {
    expect(readme.split(DETAILS_SUMMARY).length - 1).toBe(2);
    expect(readme.split(DETAILS_OPENING).length).toBe(readme.split(DETAILS_CLOSING).length);
  });
});

describe('the contributing guide', () => {
  const guide = readRepositoryFile(CONTRIBUTING);

  test('opens with the development prompt', () => {
    expect(firstBlockAfter({ text: guide, marker: '' })).toBe(promptBlockOf(DEVELOPMENT_PROMPT));
  });

  test('keeps the commands by hand in a collapsed section', () => {
    expect(guide).toContain(DETAILS_SUMMARY);
    expect(guide.split(DETAILS_OPENING).length).toBe(guide.split(DETAILS_CLOSING).length);
  });
});

describe('the self-host guide in every language', () => {
  test.each(SELF_HOST_PAGES)('%s opens with the self-host prompt, in English, and keeps the manual steps in one accordion', (page) => {
    const body = bodyOf(readRepositoryFile(page));
    expect(firstBlockAfter({ text: body, marker: '' })).toBe(promptBlockOf(SELF_HOST_PROMPT));
    expect(body.match(ACCORDION_PATTERN)?.length).toBe(1);
    expect(body.split(ACCORDION_CLOSING).length - 1).toBe(1);
  });

  test('the English accordion is titled Do it by hand', () => {
    expect(readRepositoryFile(pageOf({ folder: '' }))).toContain(ACCORDION_OPENING);
  });

  test('the prompt comes before the accordion', () => {
    const body = bodyOf(readRepositoryFile(pageOf({ folder: '' })));
    expect(body.indexOf(SELF_HOST_PROMPT)).toBeLessThan(body.indexOf(ACCORDION_OPENING));
  });
});

describe('the self-host runbook for an agent', () => {
  const runbook = runbookOf(SELF_HOST_RUNBOOK);

  test('checks the login before it touches the account, and names the stops', () => {
    expect(runbook).toContain(WHOAMI_COMMAND);
    expect(runbook).toContain('Stop and ask the owner');
  });

  test('creates the database, applies the migrations on the remote and deploys with the script', () => {
    expect(runbook).toContain(MIGRATIONS_COMMAND);
    expect(runbook).toContain(DEPLOY_COMMAND);
  });

  test('never deploys with a bare wrangler deploy or a --var', () => {
    expect(DEPLOY_WITH_VARIABLE_PATTERN.test(runbook)).toBe(false);
  });

  test('links the guide for the edits it does not repeat', () => {
    expect(runbook).toContain('https://docs.todz.app/self-host');
  });
});

describe('the development runbook for an agent', () => {
  const runbook = runbookOf(DEVELOPMENT_RUNBOOK);

  test('runs the doctor, then installs, then the gate', () => {
    const positions = [DOCTOR_COMMAND, INSTALL_COMMAND, VERIFY_COMMAND].map((command) => runbook.indexOf(command));
    expect(positions.every((position) => position !== NOT_FOUND)).toBe(true);
    expect([...positions].sort((first, second) => first - second)).toEqual(positions);
  });

  test('points at the agent guide and the process', () => {
    expect(runbook).toContain('AGENTS.md');
    expect(runbook).toContain('.claude/HARNESS.md');
  });
});
