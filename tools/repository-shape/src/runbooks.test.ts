import { existsSync, readdirSync } from 'node:fs';
import { posix } from 'node:path';
import { describe, expect, test } from 'vitest';
import { capturedNames, readRepositoryFile, repositoryPath } from './repository-files';

const RUNBOOKS_DIRECTORY = 'docs/runbooks';
const INDEX_FILE_NAME = 'README.md';
const MARKDOWN_EXTENSION = '.md';
const ROOT_PACKAGE_FILE = 'package.json';
const DEPLOY_RUNBOOK = 'deploy-the-api.md';
const AGENT_EXCEPTION_SENTENCE = 'agents never run them, except `deploy-the-api`';
const REMOTE_FLAG = '--remote';
const DEPLOY_WITH_VARIABLE_PATTERN = /wrangler deploy[^\n]*--var/;
const RUN_LOG_HEADER = '| Date | Commit | Step | Actual result |\n|------|--------|------|---------------|';
const DATABASE_COMMAND_PATTERN = /(wrangler d1 (?:migrations (?:list|apply)|export) [^\n]*)/g;
const FIRST_STEP_NUMBER = 1;
const ANCHOR_SEPARATOR = '#';
const MAX_INDEX_LINES = 20;
const PNPM_BUILT_IN_COMMANDS = ['exec', 'dlx', 'install', 'add'];
const TITLE_PATTERN = /^# .+\n\n(.+)\n/;
const STEP_PATTERN = /^(\d+)\. (.*)$/gm;
const FAILURE_LINE_PATTERN = /^ {3,4}If it fails: .+$/m;
const LINK_PATTERN = /\]\(([^)\s]+)\)/g;
const EXTERNAL_LINK_PATTERN = /^(https?:|mailto:|#)/;
const PNPM_COMMAND_PATTERN = /\bpnpm ([a-z][\w:-]*)/g;
const FENCED_BLOCK_PATTERN = /```[\s\S]*?```/g;
const CODE_FENCE = '```';
const WRAPPER_PATH = 'scripts/todz-cloudflare.sh';
const WRAPPED_WRANGLER = `${WRAPPER_PATH} pnpm --filter @todz/api exec wrangler `;
const SHELL_GUARD_PATTERN = /[$`{}]|<</;
const SHARED_TEMPORARY_PATTERN = /TMPDIR|\/tmp\b/;
const WRANGLER_CONFIGURATION = 'apps/api/wrangler.jsonc';
const ACCOUNT_ID_PATTERN = /"account_id": "([0-9a-f]{32})"/;
const REPOSITORY_SCRIPT_PATTERN = /(scripts\/[\w./-]+)/g;
const LINE_SEPARATOR = '\n';
const ACCOUNT_ID_CAPTURE = 1;
const CLOUDFLARE_API_HOST = 'api.cloudflare.com';

type Runbook = { file: string; text: string };

function runbookFiles(): string[] {
  return readdirSync(repositoryPath(RUNBOOKS_DIRECTORY)).filter((file) => file.endsWith(MARKDOWN_EXTENSION));
}

function readRunbook(file: string): Runbook {
  return { file, text: readRepositoryFile(posix.join(RUNBOOKS_DIRECTORY, file)) };
}

function allRunbooks(): Runbook[] {
  return runbookFiles().map(readRunbook);
}

function stepSections(text: string): { number: number; title: string; body: string }[] {
  const steps = [...text.matchAll(STEP_PATTERN)];
  return steps.map((match, index) => {
    const next = steps[index + 1];
    return { number: Number(match[1]), title: match[2]!, body: text.slice(match.index, next ? next.index : undefined) };
  });
}

function shapeViolations({ file, text }: Runbook): string[] {
  const purpose = TITLE_PATTERN.exec(text);
  const hasPurpose = purpose !== null && purpose[1]!.endsWith('.');
  const missingPurpose = hasPurpose ? [] : [`${file}: no purpose sentence after the title`];
  const steps = file === INDEX_FILE_NAME ? [] : stepSections(text);
  const noSteps = steps.length === 0 && file !== INDEX_FILE_NAME ? [`${file}: no numbered steps`] : [];
  const gaps = steps
    .filter((step, index) => step.number !== index + FIRST_STEP_NUMBER)
    .map((step) => `${file}: step ${step.number} is out of sequence`);
  const missingFailureLine = steps
    .filter((step) => !FAILURE_LINE_PATTERN.test(step.body))
    .map((step) => `${file}: step ${step.number} has no If it fails line`);
  return [...missingPurpose, ...noSteps, ...gaps, ...missingFailureLine];
}

function isBrokenLink({ file, target }: { file: string; target: string }): boolean {
  const path = target.split(ANCHOR_SEPARATOR, 1).join('');
  return !existsSync(repositoryPath(posix.join(RUNBOOKS_DIRECTORY, posix.dirname(file), path)));
}

function brokenLinks({ file, text }: Runbook): string[] {
  return capturedNames({ text: text.replace(FENCED_BLOCK_PATTERN, ''), pattern: LINK_PATTERN })
    .filter((target) => !EXTERNAL_LINK_PATTERN.test(target))
    .filter((target) => isBrokenLink({ file, target }))
    .map((target) => `${file}: ${target}`);
}

function commandLines(text: string): string[] {
  return [...text.matchAll(FENCED_BLOCK_PATTERN)].flatMap(([block]) =>
    block
      .split(LINE_SEPARATOR)
      .filter((line) => !line.startsWith(CODE_FENCE) && line.trim() !== '')
      .map((line) => line.trim()),
  );
}

function rootScripts(): string[] {
  return Object.keys(JSON.parse(readRepositoryFile(ROOT_PACKAGE_FILE)).scripts);
}

function unknownCommands({ file, text }: Runbook): string[] {
  const scripts = rootScripts();
  return capturedNames({ text, pattern: PNPM_COMMAND_PATTERN })
    .filter((command) => !PNPM_BUILT_IN_COMMANDS.includes(command))
    .filter((command) => !scripts.includes(command))
    .map((command) => `${file}: pnpm ${command}`);
}

describe('runbooks', () => {
  test('the index links every other runbook exactly once', () => {
    const index = readRunbook(INDEX_FILE_NAME).text;
    const linkCounts = runbookFiles()
      .filter((file) => file !== INDEX_FILE_NAME)
      .map((file) => ({ file, count: index.split(`](${file})`).length - 1 }));
    expect(linkCounts.filter((entry) => entry.count !== 1)).toEqual([]);
  });

  test('every relative link resolves to a file', () => {
    expect(allRunbooks().flatMap(brokenLinks)).toEqual([]);
  });

  test('every runbook has a purpose sentence, numbered steps and an If it fails line per step', () => {
    expect(allRunbooks().flatMap(shapeViolations)).toEqual([]);
  });

  test('a runbook with only a title is reported by name', () => {
    expect(shapeViolations({ file: 'empty.md', text: '# Empty\n' })).toEqual([
      'empty.md: no purpose sentence after the title',
      'empty.md: no numbered steps',
    ]);
  });

  test('a step without its failure line is reported by number', () => {
    const text = '# Title\n\nPurpose.\n\n1. **One.** Do it.\n   If it fails: stop.\n2. **Two.** Do it.\n';
    expect(shapeViolations({ file: 'gap.md', text })).toEqual(['gap.md: step 2 has no If it fails line']);
  });

  test('a step out of sequence is reported by number', () => {
    const text = '# Title\n\nPurpose.\n\n1. **One.** Do it.\n   If it fails: stop.\n3. **Three.** Do it.\n   If it fails: stop.\n';
    expect(shapeViolations({ file: 'order.md', text })).toEqual(['order.md: step 3 is out of sequence']);
  });

  test('a link to a missing file is reported', () => {
    expect(brokenLinks({ file: 'x.md', text: '[missing](no-such-runbook.md)' })).toEqual(['x.md: no-such-runbook.md']);
  });

  test('the index stays a short list: no numbered steps, one line per runbook', () => {
    const index = readRunbook(INDEX_FILE_NAME).text;
    expect(stepSections(index)).toEqual([]);
    expect(index.split('\n').length).toBeLessThan(MAX_INDEX_LINES);
  });

  test('every pnpm command in a runbook is a root script or a pnpm built-in', () => {
    expect(allRunbooks().flatMap(unknownCommands)).toEqual([]);
    expect(unknownCommands({ file: 'x.md', text: 'Run pnpm no-such-script.' })).toEqual(['x.md: pnpm no-such-script']);
  });

  test('the index says agents never run a runbook except deploy-the-api', () => {
    expect(readRunbook(INDEX_FILE_NAME).text).toContain(AGENT_EXCEPTION_SENTENCE);
  });

  test('every database command of the deploy runbook that Wrangler runs locally by default names --remote', () => {
    const commands = capturedNames({ text: readRunbook(DEPLOY_RUNBOOK).text, pattern: DATABASE_COMMAND_PATTERN });
    expect(commands.length).toBeGreaterThan(0);
    expect(commands.filter((command) => !command.includes(REMOTE_FLAG))).toEqual([]);
  });

  test('the deploy runbook never deploys with --var, so the deployed variables are the ones in the configuration', () => {
    expect(readRunbook(DEPLOY_RUNBOOK).text).not.toMatch(DEPLOY_WITH_VARIABLE_PATTERN);
  });

  test('the deploy runbook has command lines, none with a character the loop shell guard refuses or a shared temporary folder', () => {
    const lines = commandLines(readRunbook(DEPLOY_RUNBOOK).text);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.filter((line) => SHELL_GUARD_PATTERN.test(line) || SHARED_TEMPORARY_PATTERN.test(line))).toEqual([]);
  });

  test('every wrangler call of the deploy runbook goes through the wrapper, and no line calls the Cloudflare API directly', () => {
    const lines = commandLines(readRunbook(DEPLOY_RUNBOOK).text);
    expect(lines.filter((line) => line.includes('wrangler ') && !line.startsWith(WRAPPED_WRANGLER))).toEqual([]);
    expect(lines.filter((line) => line.includes(CLOUDFLARE_API_HOST))).toEqual([]);
  });

  test('every repository script the deploy runbook names exists, and the wrapper holds the account of wrangler.jsonc', () => {
    const named = capturedNames({
      text: commandLines(readRunbook(DEPLOY_RUNBOOK).text).join(LINE_SEPARATOR),
      pattern: REPOSITORY_SCRIPT_PATTERN,
    });
    expect(named.length).toBeGreaterThan(0);
    expect(named.filter((path) => !existsSync(repositoryPath(path)))).toEqual([]);
    const accountId = ACCOUNT_ID_PATTERN.exec(readRepositoryFile(WRANGLER_CONFIGURATION))?.[ACCOUNT_ID_CAPTURE];
    expect(accountId).toBeDefined();
    expect(readRepositoryFile(WRAPPER_PATH)).toContain(`"${accountId}"`);
  });

  test('the deploy runbook ends with a run log table for the lead', () => {
    expect(readRunbook(DEPLOY_RUNBOOK).text.trimEnd().endsWith(RUN_LOG_HEADER)).toBe(true);
  });
});
