import { existsSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { readRepositoryFile, repositoryPath } from './repository-files';

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
const CONTRIBUTOR_AGREEMENT_COMPANY = 'Logic Bit AI Software Boutique Ltda';
const CONTRIBUTOR_AGREEMENT_GRANTS = ['relicense', 'patent', 'original work', 'AGPL-3.0'];
const CONTRIBUTING_FILE = '.github/CONTRIBUTING.md';
const PULL_REQUEST_TEMPLATE = '.github/pull_request_template.md';
const CONTRIBUTOR_AGREEMENT_CHECKBOX = '- [ ] ✍️ I agree to the [Contributor License Agreement]';
const README_FILE = 'README.md';

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
});
