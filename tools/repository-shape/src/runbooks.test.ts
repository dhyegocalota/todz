import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { posix } from 'node:path';
import { describe, expect, test } from 'vitest';
import { capturedNames, readRepositoryFile, repositoryPath } from './repository-files';

const RUNBOOKS_DIRECTORY = 'docs/runbooks';
const INDEX_FILE_NAME = 'README.md';
const MARKDOWN_EXTENSION = '.md';
const ROOT_PACKAGE_FILE = 'package.json';
const DEPLOY_RUNBOOK = 'deploy-the-api.md';
const AGENT_EXCEPTION_SENTENCE = "agents never run them, except `deploy-the-api` and the loop's steps of `mintlify-publish`";
const MINTLIFY_RUNBOOK = 'mintlify-publish.md';
const SETUP_HEADING = '## Setup';
const NEXT_SECTION_PATTERN = /\n## /;
const NOT_FOUND = -1;
const OWNER_SETUP_DATE = '2026-11-25';
const OWNER_SETUP_FACTS = ['`todz`', 'Hobby', '`dhyegocalota/todz`', '`main`', '`apps/docs`', '`docs.todz.app`', 'SSL'];
const DOCS_ORIGIN = 'https://docs.todz.app';
const DOCS_CHECKED_ADDRESSES = [`${DOCS_ORIGIN}/`, `${DOCS_ORIGIN}/self-host`, `${DOCS_ORIGIN}/no-such-page`];
const PREVIEW_SETTING = '`preview: false`';
const APP_SCOPE_CHECK = 'Only select repositories';
const READ_ONLY_CLAIM = 'read-only';
const DOCS_CONFIGURATION = 'apps/docs/docs.json';
const DOCS_HOST_CHECK_STEP = 3;
const FULL_CREDIT_TAIL = 'made in Brazil';
const DOCS_GATE_COMMANDS = ['pnpm --filter @todz/docs broken-links', 'pnpm --filter @todz/docs validate'];
const DOMAIN_RECORD_PATTERN = /dns_records|CNAME|scripts\/todz-cloudflare\.sh/;
const REMOTE_FLAG = '--remote';
const DEPLOY_WITH_VARIABLE_PATTERN = /wrangler deploy[^\n]*--var/;
const RUN_LOG_HEADER = '| Date | Commit | Step | Actual result |\n|------|--------|------|---------------|';
const RUN_LOG_HEADING = '## Run log\n\n';
const RUN_LOG_ROW_PATTERN = /^\| \d{4}-\d{2}-\d{2} \| [0-9a-f]{7,40} \| \d+ \| .+ \|$/;
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
const KEYCHAIN_TURNSTILE_READ = 'security find-generic-password -s todz-turnstile -w';
const WRAPPED_WRANGLER = `${WRAPPER_PATH} pnpm --filter @todz/api exec wrangler `;
const GUARD_HOOK = '.agents/hooks/guard-secrets.sh';
const BLOCKED_EXIT_CODE = 2;
const BASH_TOOL_NAME = 'Bash';
const SHARED_TEMPORARY_PATTERN = /TMPDIR|\/tmp\b/;
const WRANGLER_CONFIGURATION = 'apps/api/wrangler.jsonc';
const ACCOUNT_ID_PATTERN = /"account_id": "([0-9a-f]{32})"/;
const REPOSITORY_SCRIPT_PATTERN = /(scripts\/[\w./-]+)/g;
const LINE_SEPARATOR = '\n';
const ACCOUNT_ID_CAPTURE = 1;
const CLOUDFLARE_API_HOST = 'api.cloudflare.com';
const SMOKE_CHECK_STEP = 13;
const HEALTH_CURL = 'curl -sS https://api.todz.app/health';
const HEALTH_ANSWER = '{"service":"todz","origin":"https://api.todz.app"}';
const ALL_PASS_SENTENCE = 'When all fourteen pass';
const SELF_HOST_PROBES = [
  'curl -sS -D - -o /dev/null https://todz.app/self-host',
  'curl -sS -D - -o /dev/null "https://www.todz.app/self-host?from=runbook"',
];
const DOCS_REDIRECT_ANSWER = '`HTTP/2 301` with `location: https://docs.todz.app/self-host`';
const SITE_REDIRECT_OF_GUIDE = 'location: https://todz.app/self-host';
const WRONG_SESSION_BODY = 'scripts/deploy-bodies/wrong-session.json';
const JUNK_LINK_BODY = 'scripts/deploy-bodies/junk-turnstile-link.json';
const JUNK_WAITLIST_BODY = 'scripts/deploy-bodies/junk-turnstile-waitlist.txt';
const JUNK_ADMIN_BODY = 'scripts/deploy-bodies/junk-turnstile-admin.txt';
const WAITLIST_ADDRESS_FIELD = 'email';
const WAITLIST_TOKEN_FIELD = 'cf-turnstile-response';
const PROBE_ADDRESS = 'nobody@example.com';
const LINK_VERIFIER_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const LINK_CHALLENGE_PATTERN = /^[0-9a-f]{64}$/;
const TURNSTILE_TOKEN_PATTERN = /^[A-Za-z0-9._-]{1,2048}$/;
const TURNSTILE_DUMMY_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';

type DeployBody = { email?: string; link_challenge?: string; link_verifier?: string; turnstile_token?: string };

type DocsFooter = { footer: { links: { header: string; items: { label: string }[] }[] } };

function deployBody(path: string): DeployBody {
  return JSON.parse(readRepositoryFile(path)) as DeployBody;
}

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
      .map((line) => line.trim())
      .filter((line) => line !== '' && !line.startsWith(CODE_FENCE)),
  );
}

function isBlockedByGuard(command: string): boolean {
  const input = JSON.stringify({ tool_name: BASH_TOOL_NAME, tool_input: { command } });
  return spawnSync(repositoryPath(GUARD_HOOK), { input }).status === BLOCKED_EXIT_CODE;
}

function mintlifySetup(): string {
  const text = readRunbook(MINTLIFY_RUNBOOK).text;
  const setupStart = text.indexOf(SETUP_HEADING);
  if (setupStart === NOT_FOUND) throw new Error(`${MINTLIFY_RUNBOOK} has no ${SETUP_HEADING} section`);
  const rest = text.slice(setupStart + SETUP_HEADING.length);
  const setupEnd = rest.search(NEXT_SECTION_PATTERN);
  return rest.slice(0, setupEnd === NOT_FOUND ? undefined : setupEnd);
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

  test('the Mintlify runbook exists', () => {
    expect(runbookFiles()).toContain(MINTLIFY_RUNBOOK);
  });

  test('the Mintlify runbook records the owner setup as done on 2026-11-25, each fact in its Setup section', () => {
    const setup = mintlifySetup();
    expect(setup).toContain(OWNER_SETUP_DATE);
    expect(OWNER_SETUP_FACTS.filter((fact) => !setup.includes(fact))).toEqual([]);
  });

  test('the Mintlify setup says previews are off on the plan and leaves the app scope to the owner, never calling the app read-only', () => {
    const setup = mintlifySetup();
    expect(setup).toContain(PREVIEW_SETTING);
    expect(setup).toContain(APP_SCOPE_CHECK);
    expect(setup).not.toContain(READ_ONLY_CLAIM);
  });

  test('the Mintlify check of the host expects the credit the docs footer holds', () => {
    const [credit] = (JSON.parse(readRepositoryFile(DOCS_CONFIGURATION)) as DocsFooter).footer.links;
    const hostCheck = stepSections(readRunbook(MINTLIFY_RUNBOOK).text).find((step) => step.number === DOCS_HOST_CHECK_STEP);
    expect(hostCheck?.body).toContain(`\`${credit?.header}\``);
    expect(hostCheck?.body).toContain(`\`${credit?.items[0]?.label}\``);
    expect(hostCheck?.body).not.toContain(FULL_CREDIT_TAIL);
  });

  test('the Mintlify runbook runs the docs checks before any step that asks the docs host', () => {
    const steps = stepSections(readRunbook(MINTLIFY_RUNBOOK).text);
    const checkStep = steps.find((step) => DOCS_GATE_COMMANDS.every((command) => step.body.includes(command)));
    const hostSteps = steps.filter((step) => step.body.includes(DOCS_ORIGIN));
    expect(checkStep).toBeDefined();
    expect(hostSteps.length).toBeGreaterThan(0);
    expect(hostSteps.filter((step) => step.number < checkStep!.number)).toEqual([]);
  });

  test('the Mintlify check after the merge asks the introduction, the guide and a missing page', () => {
    const text = readRunbook(MINTLIFY_RUNBOOK).text;
    expect(DOCS_CHECKED_ADDRESSES.filter((address) => !text.includes(address))).toEqual([]);
  });

  test('the Mintlify runbook names no DNS record', () => {
    expect(readRunbook(MINTLIFY_RUNBOOK).text).not.toMatch(DOMAIN_RECORD_PATTERN);
  });

  test('the Mintlify runbook ends with a run log table', () => {
    const text = readRunbook(MINTLIFY_RUNBOOK).text.trimEnd();
    const logStart = text.indexOf(`${RUN_LOG_HEADING}${RUN_LOG_HEADER}`);
    const rows = text
      .slice(logStart + RUN_LOG_HEADING.length + RUN_LOG_HEADER.length)
      .split(LINE_SEPARATOR)
      .filter(Boolean);
    expect(logStart).toBeGreaterThan(0);
    expect(rows.filter((row) => !RUN_LOG_ROW_PATTERN.test(row))).toEqual([]);
  });

  test('the index says agents never run a runbook except deploy-the-api and the loop steps of mintlify-publish', () => {
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

  test('the deploy runbook has command lines, none the secrets guard hook blocks or with a shared temporary folder', () => {
    const lines = commandLines(readRunbook(DEPLOY_RUNBOOK).text);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.filter((line) => isBlockedByGuard(line) || SHARED_TEMPORARY_PATTERN.test(line))).toEqual([]);
  });

  test('the guard hook helper blocks a command that writes a dotenv file and passes a plain read', () => {
    expect(isBlockedByGuard('touch .env')).toBe(true);
    expect(isBlockedByGuard('git status')).toBe(false);
  });

  test('every wrangler call of the deploy runbook goes through the wrapper, and no line calls the Cloudflare API directly', () => {
    const lines = commandLines(readRunbook(DEPLOY_RUNBOOK).text);
    const isWrapped = (line: string): boolean =>
      line.startsWith(WRAPPED_WRANGLER) || line.startsWith(`${KEYCHAIN_TURNSTILE_READ} | ${WRAPPED_WRANGLER}`);
    expect(lines.filter((line) => line.includes('wrangler ') && !isWrapped(line))).toEqual([]);
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

  test('the smoke check curls the health route of the API host and counts it among the fourteen answers', () => {
    const smokeCheck = stepSections(readRunbook(DEPLOY_RUNBOOK).text).find((step) => step.number === SMOKE_CHECK_STEP);
    expect(smokeCheck?.body).toContain(HEALTH_CURL);
    expect(smokeCheck?.body).toContain(HEALTH_ANSWER);
    expect(smokeCheck?.body).toContain(ALL_PASS_SENTENCE);
  });

  test('the smoke check expects both self-host probes to answer 301 to the guide on the docs', () => {
    const smokeCheck = stepSections(readRunbook(DEPLOY_RUNBOOK).text).find((step) => step.number === SMOKE_CHECK_STEP);
    expect(SELF_HOST_PROBES.filter((probe) => !smokeCheck?.body.includes(probe))).toEqual([]);
    expect(smokeCheck?.body).toContain(DOCS_REDIRECT_ANSWER);
    expect(smokeCheck?.body).not.toContain(SITE_REDIRECT_OF_GUIDE);
  });

  test('the wrong session body is refused before siteverify, by a malformed verifier, and carries an unsolved token', () => {
    const body = deployBody(WRONG_SESSION_BODY);
    expect(body.link_verifier).toBeDefined();
    expect(body.link_verifier).not.toMatch(LINK_VERIFIER_PATTERN);
    expect(body.turnstile_token).toMatch(TURNSTILE_TOKEN_PATTERN);
    expect(body.turnstile_token).not.toBe(TURNSTILE_DUMMY_TOKEN);
  });

  test('the junk link body is well formed but for its unsolved token, so only Turnstile refuses it', () => {
    const body = deployBody(JUNK_LINK_BODY);
    expect(body.link_challenge).toMatch(LINK_CHALLENGE_PATTERN);
    expect(body.email).toMatch(/^[^@\s]+@example\.com$/);
    expect(body.turnstile_token).toMatch(TURNSTILE_TOKEN_PATTERN);
    expect(body.turnstile_token).not.toBe(TURNSTILE_DUMMY_TOKEN);
  });

  test('the junk waitlist body reaches siteverify byte for byte, so only Turnstile refuses it', () => {
    const fields = new URLSearchParams(readRepositoryFile(JUNK_WAITLIST_BODY));
    expect(fields.get(WAITLIST_ADDRESS_FIELD)).toBe(PROBE_ADDRESS);
    expect(fields.get(WAITLIST_TOKEN_FIELD)).toMatch(TURNSTILE_TOKEN_PATTERN);
    expect(fields.get(WAITLIST_TOKEN_FIELD)).not.toBe(TURNSTILE_DUMMY_TOKEN);
  });

  test('the junk admin body reaches siteverify byte for byte, so only Turnstile refuses it', () => {
    const fields = new URLSearchParams(readRepositoryFile(JUNK_ADMIN_BODY));
    expect(fields.get(WAITLIST_ADDRESS_FIELD)).toBe(PROBE_ADDRESS);
    expect(fields.get(WAITLIST_TOKEN_FIELD)).toMatch(TURNSTILE_TOKEN_PATTERN);
    expect(fields.get(WAITLIST_TOKEN_FIELD)).not.toBe(TURNSTILE_DUMMY_TOKEN);
  });

  test('the deploy runbook ends with a run log table whose rows name a date, a commit and a step', () => {
    const text = readRunbook(DEPLOY_RUNBOOK).text.trimEnd();
    const logStart = text.indexOf(`${RUN_LOG_HEADING}${RUN_LOG_HEADER}`);
    const rows = text
      .slice(logStart + RUN_LOG_HEADING.length + RUN_LOG_HEADER.length)
      .split(LINE_SEPARATOR)
      .filter(Boolean);
    expect(logStart).toBeGreaterThan(0);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.filter((row) => !RUN_LOG_ROW_PATTERN.test(row))).toEqual([]);
  });
});
