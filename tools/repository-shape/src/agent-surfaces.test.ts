import { existsSync, readdirSync } from 'node:fs';
import { posix } from 'node:path';
import { describe, expect, test } from 'vitest';
import { capturedNames, readRepositoryFile, repositoryPath } from './repository-files';

const ROLES_DIRECTORY = '.agents/roles';
const CLAUDE_AGENTS_DIRECTORY = '.claude/agents';
const CODEX_AGENTS_DIRECTORY = '.codex/agents';
const CODEX_CONFIG_FILE = '.codex/config.toml';
const MARKDOWN_EXTENSION = '.md';
const TOML_EXTENSION = '.toml';
const EXPECTED_ROLES = ['developer', 'frontend-designer', 'recorder', 'researcher', 'reviewer', 'security-reviewer', 'tester'];
const VERIFY_SKILL_FILE = '.agents/skills/verify/SKILL.md';
const OPEN_PR_SKILL_FILE = '.agents/skills/open-pr/SKILL.md';
const VERIFY_SCRIPT_FILE = 'scripts/verify.sh';
const DOCTOR_SCRIPT_CALL = '"$root/.agents/hooks/doctor.sh"';
const GATE_COMMAND = '`pnpm verify';
const DEPLOY_SKILL_FILE = '.agents/skills/deploy/SKILL.md';
const CLAUDE_DEPLOY_SKILL_FILE = '.claude/skills/deploy/SKILL.md';
const DEPLOY_SKILL_NAME_LINE = 'name: deploy';
const DEPLOY_SKILL_LINK_PATTERN = /\]\((\.\.\/\.\.\/\.\.\/[^)\s]+)\)/g;
const DEPLOY_SKILL_DIRECTORY = '.agents/skills/deploy';
const DEPLOY_SKILL_MENTIONS = [
  'docs/runbooks/deploy-the-api.md',
  'docs/runbooks/release-the-mac-app.md',
  'git diff --quiet <tag> HEAD -- apps/macos',
  'pnpm release:mac',
  '/download/latest',
  'appcast.xml',
  'shasum -a 256 -c',
  'ssh-keygen -Y verify',
  'apps/macos/release/allowed-signers',
  'Stop at the first failure',
  'leaves the previous release live',
];
const GATE_STEPS = ['pnpm typecheck', 'pnpm security:audit', 'pnpm test:unit', 'pnpm test:e2e', 'gitleaks git'];

function roleNames(): string[] {
  return readdirSync(repositoryPath(ROLES_DIRECTORY))
    .filter((file) => file.endsWith(MARKDOWN_EXTENSION))
    .map((file) => file.slice(0, -MARKDOWN_EXTENSION.length))
    .sort();
}

function wrapperNamesRole({ directory, extension, role }: { directory: string; extension: string; role: string }): boolean {
  const wrapperPath = `${directory}/${role}${extension}`;
  try {
    return readRepositoryFile(wrapperPath).includes(`${ROLES_DIRECTORY}/${role}${MARKDOWN_EXTENSION}`);
  } catch {
    return false;
  }
}

describe('agent surfaces', () => {
  test('the roles are exactly the expected ones', () => {
    expect(roleNames()).toEqual(EXPECTED_ROLES);
  });

  test('every role has a Claude Code wrapper that names its role file', () => {
    const missing = roleNames().filter(
      (role) => !wrapperNamesRole({ directory: CLAUDE_AGENTS_DIRECTORY, extension: MARKDOWN_EXTENSION, role }),
    );
    expect(missing).toEqual([]);
  });

  test('every role has a Codex wrapper that names its role file', () => {
    const missing = roleNames().filter((role) => !wrapperNamesRole({ directory: CODEX_AGENTS_DIRECTORY, extension: TOML_EXTENSION, role }));
    expect(missing).toEqual([]);
  });

  test('every role is registered in the Codex configuration', () => {
    const config = readRepositoryFile(CODEX_CONFIG_FILE);
    const missing = roleNames().filter(
      (role) => !config.includes(`[agents.${role}]\nconfig_file = "${CODEX_AGENTS_DIRECTORY}/${role}${TOML_EXTENSION}"`),
    );
    expect(missing).toEqual([]);
  });

  test('the verify skill runs the one gate, which calls the doctor script, not the pnpm built-in of the same name', () => {
    expect(readRepositoryFile(VERIFY_SKILL_FILE)).toContain(GATE_COMMAND);
    expect(readRepositoryFile(VERIFY_SCRIPT_FILE)).toContain(DOCTOR_SCRIPT_CALL);
  });

  test('the deploy skill is one source that Claude Code reads through the skills link, and it names its name', () => {
    expect(readRepositoryFile(DEPLOY_SKILL_FILE)).toContain(DEPLOY_SKILL_NAME_LINE);
    expect(readRepositoryFile(CLAUDE_DEPLOY_SKILL_FILE)).toBe(readRepositoryFile(DEPLOY_SKILL_FILE));
  });

  test('the deploy skill orders the two runbooks, releases only when the app changed, checks production and stops at the first failure', () => {
    const skill = readRepositoryFile(DEPLOY_SKILL_FILE);
    expect(DEPLOY_SKILL_MENTIONS.filter((mention) => !skill.includes(mention))).toEqual([]);
  });

  test('every link of the deploy skill resolves to a file', () => {
    const skill = readRepositoryFile(DEPLOY_SKILL_FILE);
    const targets = capturedNames({ text: skill, pattern: DEPLOY_SKILL_LINK_PATTERN });
    expect(targets.length).toBeGreaterThan(0);
    expect(targets.filter((target) => !existsSync(repositoryPath(posix.join(DEPLOY_SKILL_DIRECTORY, target))))).toEqual([]);
  });

  test('the verify and open-pr skills never repeat the steps of the gate', () => {
    const skills = [VERIFY_SKILL_FILE, OPEN_PR_SKILL_FILE].map((file) => readRepositoryFile(file)).join('\n');
    expect(GATE_STEPS.filter((step) => skills.includes(step))).toEqual([]);
  });
});
