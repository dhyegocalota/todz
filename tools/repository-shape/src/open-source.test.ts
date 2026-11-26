import { existsSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { COMPANY } from '../../../libs/types/src/constants';
import { committableFiles, readRepositoryFile, repositoryPath } from './repository-files';

const ROOT_LICENSE_FILE = 'LICENSE';
const ROOT_LICENSE_TITLE = 'GNU AFFERO GENERAL PUBLIC LICENSE';
const ROOT_LICENSE_IDENTIFIER = 'AGPL-3.0-only';
const PACKAGE_MANIFEST = 'package.json';
const COMMUNITY_FILES = ['.github/CONTRIBUTING.md', '.github/SECURITY.md', '.github/CODE_OF_CONDUCT.md'];
const ISSUE_TEMPLATES = [
  '.github/ISSUE_TEMPLATE/config.yml',
  '.github/ISSUE_TEMPLATE/bug_report.yml',
  '.github/ISSUE_TEMPLATE/feature_request.yml',
];
const CODE_OWNERS_FILE = '.github/CODEOWNERS';
const CODE_OWNER = '@dhyegocalota';
const DEPENDABOT_FILE = '.github/dependabot.yml';
const CONTRIBUTOR_AGREEMENT_FILE = '.github/CLA.md';
const CONTRIBUTOR_AGREEMENT_LINK = 'CLA.md';
const CONTRIBUTOR_AGREEMENT_COMPANY = COMPANY.legalName;
const CONTRIBUTOR_AGREEMENT_GRANTS = ['relicense', 'patent', 'original work', 'AGPL-3.0'];
const CONTRIBUTING_FILE = '.github/CONTRIBUTING.md';
const PULL_REQUEST_TEMPLATE = '.github/pull_request_template.md';
const CONTRIBUTOR_AGREEMENT_CHECKBOX = '- [ ] ✍️ I agree to the [Contributor License Agreement]';
const README_FILE = 'README.md';
const SECURITY_FILE = '.github/SECURITY.md';
const SECURITY_ADDRESS = 'security@todz.app';
const ISSUE_TEMPLATE_CONFIG = '.github/ISSUE_TEMPLATE/config.yml';
const DOCS_ORIGIN = 'https://docs.todz.app';
const DOWNLOAD_ADDRESS = 'https://todz.app/download';
const SECURITY_ADVISORY_PATH = '/security/advisories/new';
const OPEN_SOURCE_RUNBOOK = 'docs/runbooks/open-source.md';
const RUN_LOG_HEADER = '| Date | Commit | Step | Actual result |\n|------|--------|------|---------------|';
const RUN_LOG_HEADING = '## Run log\n\n';
const ACCOUNT_SUBDOMAIN_ADDRESS_PATTERN = /[a-z0-9-]+\.(?!example\.)[a-z0-9-]+\.workers\.dev/;
const BINARY_BYTE = '\u0000';

function filesNamingAnAccountSubdomain(): string[] {
  return committableFiles().filter((path) => {
    const text = readRepositoryFile(path);
    return !text.includes(BINARY_BYTE) && ACCOUNT_SUBDOMAIN_ADDRESS_PATTERN.test(text);
  });
}
const RUN_LOG_ROW_PATTERN = /^\| \d{4}-\d{2}-\d{2} \| [0-9a-f]{7,40} \| \d+ \| .+ \|$/;
const LINE_SEPARATOR = '\n';
const LICENSING_DECISION = 'docs/adr/0081-the-whole-repository-is-agpl-3-0-only-and-going-public-follows-a-pre-flight-runbook.md';
const POST_FLIP_STEPS = [
  'private vulnerability reporting',
  'secret scanning',
  'push protection',
  'Dependabot alerts',
  'branch protection',
  'topics',
];

describe('open source', () => {
  test('the repository is licensed under the AGPL', () => {
    expect(readRepositoryFile(ROOT_LICENSE_FILE)).toContain(ROOT_LICENSE_TITLE);
    expect(JSON.parse(readRepositoryFile(PACKAGE_MANIFEST)).license).toBe(ROOT_LICENSE_IDENTIFIER);
  });

  test.each([...COMMUNITY_FILES, ...ISSUE_TEMPLATES])('%s exists', (path) => {
    expect(existsSync(repositoryPath(path))).toBe(true);
  });

  test('the README links the license and the community files', () => {
    const readme = readRepositoryFile(README_FILE);
    [ROOT_LICENSE_FILE, ...COMMUNITY_FILES].forEach((path) => expect(readme).toContain(`](${path})`));
  });

  test('the repository names its code owner', () => {
    expect(readRepositoryFile(CODE_OWNERS_FILE)).toContain(CODE_OWNER);
  });

  test('no dependabot configuration opens update pull requests', () => {
    expect(existsSync(repositoryPath(DEPENDABOT_FILE))).toBe(false);
  });

  test('the contributor license agreement names the company and what it grants', () => {
    const agreement = readRepositoryFile(CONTRIBUTOR_AGREEMENT_FILE);
    expect(agreement).toContain(CONTRIBUTOR_AGREEMENT_COMPANY);
    expect(CONTRIBUTOR_AGREEMENT_GRANTS.filter((grant) => !agreement.includes(grant))).toEqual([]);
  });

  test('contributing and the pull request template ask for the agreement', () => {
    expect(readRepositoryFile(CONTRIBUTING_FILE)).toContain(CONTRIBUTOR_AGREEMENT_LINK);
    expect(readRepositoryFile(PULL_REQUEST_TEMPLATE)).toContain(CONTRIBUTOR_AGREEMENT_CHECKBOX);
  });

  test('the pull request template and the agreement exist beside the code owners', () => {
    [CODE_OWNERS_FILE, PULL_REQUEST_TEMPLATE, CONTRIBUTOR_AGREEMENT_FILE].forEach((path) =>
      expect(existsSync(repositoryPath(path))).toBe(true),
    );
  });

  test('the README links the docs and the download in its badges', () => {
    const readme = readRepositoryFile(README_FILE);
    expect(readme).toContain(`](${DOCS_ORIGIN})`);
    expect(readme).toContain(`](${DOWNLOAD_ADDRESS})`);
  });

  test('the security policy names the address and the issue template configuration the private advisory form', () => {
    expect(readRepositoryFile(SECURITY_FILE)).toContain(SECURITY_ADDRESS);
    expect(readRepositoryFile(ISSUE_TEMPLATE_CONFIG)).toContain(SECURITY_ADVISORY_PATH);
  });

  test('the issue template configuration links the docs', () => {
    expect(readRepositoryFile(ISSUE_TEMPLATE_CONFIG)).toContain(DOCS_ORIGIN);
  });

  test('the licensing decision exists', () => {
    expect(existsSync(repositoryPath(LICENSING_DECISION))).toBe(true);
  });

  test('the open source runbook names every step after the visibility flip', () => {
    const runbook = readRepositoryFile(OPEN_SOURCE_RUNBOOK);
    expect(POST_FLIP_STEPS.filter((step) => !runbook.includes(step))).toEqual([]);
  });

  test('the open source runbook ends with a run log table whose rows name a date, a commit and a step', () => {
    const text = readRepositoryFile(OPEN_SOURCE_RUNBOOK).trimEnd();
    const logStart = text.indexOf(`${RUN_LOG_HEADING}${RUN_LOG_HEADER}`);
    const rows = text
      .slice(logStart + RUN_LOG_HEADING.length + RUN_LOG_HEADER.length)
      .split(LINE_SEPARATOR)
      .filter(Boolean);
    expect(logStart).toBeGreaterThan(0);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.filter((row) => !RUN_LOG_ROW_PATTERN.test(row))).toEqual([]);
  });

  test("no tracked file names the Cloudflare account's workers.dev subdomain", () => {
    expect(filesNamingAnAccountSubdomain()).toEqual([]);
  });
});
