import { existsSync, readdirSync } from 'node:fs';
import { posix } from 'node:path';
import { describe, expect, test } from 'vitest';
import { readRepositoryFile, repositoryPath } from './repository-files';

const WORKFLOW_FILE = '.github/workflows/verify.yml';
const JOB_LINE_PATTERN = /^ {2}[\w-]+:$/;
const JOB_INDENT_LENGTH = 2;
const NEXT_JOB_PATTERN = /\n {2}\S[^\n]*:\n/;
const CHANGES_JOB = 'changes';
const SUMMARY_JOB = 'ci-ok';
const SERVER_UNIT_JOB = 'unit-server';
const E2E_JOB = 'e2e';
const DOCS_JOB = 'docs';
const MACOS_JOB = 'macos';
const ALWAYS_JOBS = ['checks', 'unit', 'security'];
const FILTERED_JOBS = [SERVER_UNIT_JOB, E2E_JOB, DOCS_JOB, MACOS_JOB];
const WORK_JOBS = ['checks', 'unit', ...FILTERED_JOBS, 'security'];
const EXPECTED_JOBS = [CHANGES_JOB, ...WORK_JOBS, SUMMARY_JOB];
const DOCTOR_ENVIRONMENT = ['GH_TOKEN: ${{ github.token }}', 'DOCTOR_SKIP: chromium'];
const CHECKS_JOB = 'checks';
const CHECKS_STEPS = [
  'run: pnpm format:check',
  'run: pnpm typecheck',
  'run: pnpm test:hooks',
  'run: pnpm test:verify',
  'run: .agents/hooks/doctor.sh',
];
const SECURITY_JOB = 'security';
const SECURITY_STEPS = [
  'run: pnpm security:audit',
  'sha256sum --check --strict',
  'run: .github/scripts/secret-rules-probe.sh ./gitleaks',
  'run: ./gitleaks git --no-banner --redact --exit-code 1 .',
  'run: ./gitleaks dir --no-banner --redact --exit-code 1 .',
];
const TREE_SCAN_STEP = 'run: ./gitleaks dir --no-banner --redact --exit-code 1 .';
const FULL_HISTORY_CHECKOUT = 'fetch-depth: 0';
const UNIT_JOB = 'unit';
const INSTALL_ACTION = 'uses: ./.github/actions/install';
const NEEDS_CHANGES = 'needs: changes';
const NEEDS_KEY = 'needs:';
const TIMEOUT_PATTERN = /timeout-minutes: (\d+)/;
const MAXIMUM_TIMEOUT_MINUTES = 30;
const WORKFLOW_TRIGGERS =
  '\non:\n  pull_request:\n    branches: [main]\n    types: [opened, synchronize, reopened, ready_for_review]\n  workflow_dispatch:\n\npermissions:';
const PUSH_TRIGGER = '  push:';
const WORKFLOW_PERMISSIONS = '\npermissions:\n  contents: read\n';
const WORKFLOW_CONCURRENCY = '\nconcurrency:\n  group: ci-${{ github.ref }}\n  cancel-in-progress: true\n';
const JOBS_START = '\njobs:\n';
const LINE_SEPARATOR = '\n';
const PATHS_FILTER_STEP = 'uses: dorny/paths-filter@';
const CHANGES_PERMISSIONS = 'pull-requests: read';
const FILTERED_PATHS = [
  'apps/macos/**',
  'apps/api/**',
  'libs/**',
  'tools/perf/**',
  'apps/docs/**',
  '.github/**',
  'scripts/**',
  'package.json',
  'pnpm-lock.yaml',
];
const DISPATCH_RUNS_EVERYTHING = "github.event_name == 'workflow_dispatch'";
const DRAFT_GUARD = 'github.event.pull_request.draft != true';
const CHANGES_OUTPUT_REFERENCE = 'needs.changes.outputs.';
const SUMMARY_ALWAYS = 'if: always()';
const SUMMARY_NEEDS_INPUT = 'NEEDS: ${{ toJSON(needs) }}';
const SUMMARY_VERDICT = '.result == "success" or .result == "skipped"';
const UNIT_MATRIX_ENTRIES = ['{ name: repository-shape, filter: "@todz/repository-shape" }', '{ name: types, filter: "@todz/types" }'];
const SERVER_UNIT_MATRIX_ENTRIES = [
  '{ name: api, filter: "@todz/api" }',
  '{ name: core, filter: "@todz/core" }',
  '{ name: perf, filter: "@todz/perf" }',
];
const UNIT_FILTER_STEP = 'run: pnpm --filter "$FILTER" test:unit';
const UNIT_FILTER_ENVIRONMENT = 'FILTER: ${{ matrix.filter }}';
const FAIL_FAST_DISABLED = 'fail-fast: false';
const CACHE_ACTION = 'uses: actions/cache@';
const PLAYWRIGHT_CACHE_PATH = '~/.cache/ms-playwright';
const E2E_STEPS = ['playwright install --with-deps chromium', 'run: pnpm --filter @todz/api test:e2e'];
const DOCS_STEP = 'run: pnpm --filter @todz/docs run broken-links';
const MACOS_RUNNER = 'runs-on: macos-latest';
const MACOS_STEP = 'run: scripts/verify-macos.sh CODE_SIGNING_ALLOWED=NO';
const SWIFT_CACHE_PATH = 'apps/macos/TodzKit/.build';
const DERIVED_DATA_CACHE_PATH = 'apps/macos/build';
const TOKEN_REFERENCE = 'secrets.';
const WORKFLOWS_DIRECTORY = '.github/workflows';
const ACTIONS_DIRECTORY = '.github/actions';
const YAML_EXTENSION = '.yml';
const EXTERNAL_ACTION_PATTERN = /^\s*-?\s*uses: (?!\.\/)(\S+)(.*)$/gm;
const PINNED_ACTION_PATTERN = /^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/;
const VERSION_COMMENT_PATTERN = /^ # v\d[\w.-]*$/;

function yamlFiles(directory: string): string[] {
  if (!existsSync(repositoryPath(directory))) return [];
  return readdirSync(repositoryPath(directory), { withFileTypes: true }).flatMap((entry) => {
    const path = posix.join(directory, entry.name);
    if (entry.isDirectory()) return yamlFiles(path);
    return entry.name.endsWith(YAML_EXTENSION) ? [path] : [];
  });
}

function job(name: string): string {
  const workflow = readRepositoryFile(WORKFLOW_FILE);
  const jobStart = `\n  ${name}:\n`;
  const start = workflow.indexOf(jobStart);
  if (start === -1) throw new Error(`${WORKFLOW_FILE} has no ${name} job`);
  const rest = workflow.slice(start + jobStart.length);
  const next = rest.search(NEXT_JOB_PATTERN);
  return next === -1 ? rest : rest.slice(0, next);
}

function jobNames(): string[] {
  const workflow = readRepositoryFile(WORKFLOW_FILE);
  const jobs = workflow.slice(workflow.indexOf(JOBS_START));
  return jobs
    .split(LINE_SEPARATOR)
    .filter((line) => JOB_LINE_PATTERN.test(line))
    .map((line) => line.slice(JOB_INDENT_LENGTH, -1));
}

describe('CI workflow', () => {
  test('the workflow grants the token read access to the contents only', () => {
    const workflow = readRepositoryFile(WORKFLOW_FILE);
    expect(workflow).toContain(WORKFLOW_PERMISSIONS);
    expect(workflow.indexOf(WORKFLOW_PERMISSIONS)).toBeLessThan(workflow.indexOf(JOBS_START));
  });

  test('the workflow runs on pull requests to main, also when one leaves draft, and when dispatched, never on a push', () => {
    const workflow = readRepositoryFile(WORKFLOW_FILE);
    expect(workflow).toContain(WORKFLOW_TRIGGERS);
    expect(workflow).not.toContain(PUSH_TRIGGER);
  });

  test('a new run of the same ref cancels the one in flight', () => {
    expect(readRepositoryFile(WORKFLOW_FILE)).toContain(WORKFLOW_CONCURRENCY);
  });

  test('the workflow runs the changes job, the work jobs and the summary', () => {
    expect(jobNames()).toEqual(EXPECTED_JOBS);
  });

  test('the checks job checks the formatting, typechecks, tests the hooks and the gate script and runs the machine doctor script', () => {
    const checks = job(CHECKS_JOB);
    expect(CHECKS_STEPS.filter((step) => !checks.includes(step))).toEqual([]);
    expect(DOCTOR_ENVIRONMENT.filter((entry) => !checks.includes(entry))).toEqual([]);
  });

  test('the security job audits production dependencies and scans the full history for secrets without a token', () => {
    const security = job(SECURITY_JOB);
    expect(SECURITY_STEPS.filter((step) => !security.includes(step))).toEqual([]);
    expect(security).toContain(FULL_HISTORY_CHECKOUT);
    expect(security).not.toContain(TOKEN_REFERENCE);
  });

  test('the security job scans the tree before the dependencies are installed', () => {
    const security = job(SECURITY_JOB);
    expect(security.indexOf(TREE_SCAN_STEP)).toBeLessThan(security.indexOf(INSTALL_ACTION));
  });

  test('the changes job filters the paths with the pinned action, which reads the pull request', () => {
    const changes = job(CHANGES_JOB);
    expect(changes).toContain(PATHS_FILTER_STEP);
    expect(changes).toContain(CHANGES_PERMISSIONS);
    expect(FILTERED_PATHS.filter((path) => !changes.includes(path))).toEqual([]);
  });

  test('a dispatched run treats every area as changed', () => {
    expect(job(CHANGES_JOB)).toContain(DISPATCH_RUNS_EVERYTHING);
  });

  test('only the filtered jobs wait for the changes job', () => {
    expect(FILTERED_JOBS.filter((name) => !job(name).includes(NEEDS_CHANGES))).toEqual([]);
    expect(ALWAYS_JOBS.filter((name) => job(name).includes(NEEDS_KEY))).toEqual([]);
  });

  test('a filtered job runs on its own changes and skips while the pull request is a draft', () => {
    const unguarded = FILTERED_JOBS.filter((name) => !job(name).includes(DRAFT_GUARD) || !job(name).includes(CHANGES_OUTPUT_REFERENCE));
    expect(unguarded).toEqual([]);
  });

  test('the summary runs always, waits for every other job and passes only when each succeeded or was skipped', () => {
    const summary = job(SUMMARY_JOB);
    expect(summary).toContain(SUMMARY_ALWAYS);
    expect(summary).toContain(SUMMARY_NEEDS_INPUT);
    expect(summary).toContain(SUMMARY_VERDICT);
    expect([CHANGES_JOB, ...WORK_JOBS].filter((name) => !summary.includes(`- ${name}`))).toEqual([]);
    expect(summary).not.toContain(INSTALL_ACTION);
  });

  test('every work job that runs a package script installs through the composite action', () => {
    expect(WORK_JOBS.filter((name) => name !== MACOS_JOB).filter((name) => !job(name).includes(INSTALL_ACTION))).toEqual([]);
  });

  test('the unit matrix lists the workspace packages every change tests', () => {
    const unit = job(UNIT_JOB);
    expect(UNIT_MATRIX_ENTRIES.filter((entry) => !unit.includes(entry))).toEqual([]);
  });

  test('the server unit matrix lists the api, core and perf packages', () => {
    const serverUnit = job(SERVER_UNIT_JOB);
    expect(SERVER_UNIT_MATRIX_ENTRIES.filter((entry) => !serverUnit.includes(entry))).toEqual([]);
    expect(serverUnit).toContain(UNIT_FILTER_STEP);
    expect(serverUnit).toContain(UNIT_FILTER_ENVIRONMENT);
  });

  test('the unit step filters by the matrix filter through the environment, never inline', () => {
    expect(job(UNIT_JOB)).toContain(UNIT_FILTER_STEP);
    expect(job(UNIT_JOB)).toContain(UNIT_FILTER_ENVIRONMENT);
    expect(job(UNIT_JOB)).not.toMatch(/run:[^\n]*\$\{\{ matrix/);
  });

  test('the unit job checks out the full history, which the feature status check reads', () => {
    expect(job(UNIT_JOB)).toContain(FULL_HISTORY_CHECKOUT);
  });

  test('a failing unit matrix entry does not cancel the others', () => {
    expect(job(UNIT_JOB)).toContain(FAIL_FAST_DISABLED);
    expect(job(SERVER_UNIT_JOB)).toContain(FAIL_FAST_DISABLED);
  });

  test('the e2e job installs chromium, caches the browsers and runs the api end-to-end script', () => {
    const e2e = job(E2E_JOB);
    expect(E2E_STEPS.filter((step) => !e2e.includes(step))).toEqual([]);
    expect(e2e).toContain(CACHE_ACTION);
    expect(e2e).toContain(PLAYWRIGHT_CACHE_PATH);
  });

  test('the docs job checks the broken links through the docs script', () => {
    expect(job(DOCS_JOB)).toContain(DOCS_STEP);
  });

  test('the macos job runs the shared macOS script on a macOS runner and caches SwiftPM and DerivedData', () => {
    const macos = job(MACOS_JOB);
    expect(macos).toContain(MACOS_RUNNER);
    expect(macos).toContain(MACOS_STEP);
    expect(macos).toContain(SWIFT_CACHE_PATH);
    expect(macos).toContain(DERIVED_DATA_CACHE_PATH);
  });

  test('every job has a bounded timeout', () => {
    const unbounded = EXPECTED_JOBS.filter((name) => {
      const match = TIMEOUT_PATTERN.exec(job(name));
      return match === null || Number(match[1]) > MAXIMUM_TIMEOUT_MINUTES;
    });
    expect(unbounded).toEqual([]);
  });

  test('every external action is pinned to a full commit hash with its version tag as a trailing comment', () => {
    const unpinned = [...yamlFiles(WORKFLOWS_DIRECTORY), ...yamlFiles(ACTIONS_DIRECTORY)].flatMap((file) =>
      [...readRepositoryFile(file).matchAll(EXTERNAL_ACTION_PATTERN)]
        .filter(([, action, trailer]) => !PINNED_ACTION_PATTERN.test(action!) || !VERSION_COMMENT_PATTERN.test(trailer!))
        .map(([, action]) => `${file}: ${action}`),
    );
    expect(unpinned).toEqual([]);
  });
});
