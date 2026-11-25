import { existsSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { bodyOf, frontMatterOf } from './front-matter';
import { readRepositoryFile, repositoryPath } from './repository-files';

const SKILL_FILE = '.agents/skills/deploy/SKILL.md';
const CLAUDE_SKILL_FILE = '.claude/skills/deploy/SKILL.md';
const SKILLS_README = '.agents/skills/README.md';
const HARNESS_FILE = '.claude/HARNESS.md';
const DEPLOY_RUNBOOK = 'docs/runbooks/deploy-the-api.md';
const DEPLOY_RUNBOOK_PURPOSE_LINES = 3;
const SKILL_NAME = 'deploy';
const ONE_WAY_SENTENCE = 'the one way an agent deploys';
const RELEASE_COMMAND = 'pnpm release:mac';
const RELEASE_CONDITION = 'git diff --quiet <tag> HEAD -- apps/macos';
const HIGHEST_TAG_WORDS = 'highest `mac-v*` tag';
const FIRST_RELEASE_WORDS = 'no tag exists';
const GATE_COMMAND = 'pnpm verify all';
const DEPLOY_SCRIPT = 'scripts/deploy-worker.sh';
const PRODUCTION_CHECKS = [
  'curl -sS -D - -o /dev/null https://todz.app/download/latest',
  'shasum -a 256 -c',
  'ssh-keygen -Y verify -f apps/macos/release/allowed-signers -I release@todz.app -n todz-release',
  'sparkle:shortVersionString="<version>"',
];
const STOP_SENTENCES = ['stops at the first failure', 'leaves the previous release live'];
const NOT_LIVE_SENTENCE = 'the Mac release is not live yet';
const FORBIDDEN_SENTENCES = [
  'never retries a deploy blindly',
  'never edits `~/.todz-release` by hand',
  'never runs a bare `wrangler rollback`',
];
const HARNESS_LAYOUT_LINE = '.agents/skills/      skills:';
const HARNESS_TABLE_ROW = '| `deploy` | skill |';

function skill(): string {
  return readRepositoryFile(SKILL_FILE);
}

describe('the deploy skill', () => {
  test('is named deploy and says it is the one way an agent deploys', () => {
    const header = frontMatterOf(skill());
    expect(header.name).toBe(SKILL_NAME);
    expect(header.description).toContain(ONE_WAY_SENTENCE);
  });

  test('is one source that Claude Code reads through the skills link', () => {
    expect(readRepositoryFile(CLAUDE_SKILL_FILE)).toBe(skill());
  });

  test('runs the gate, the deploy runbook, the release only when the app changed, and the production checks', () => {
    const body = bodyOf(skill());
    expect(existsSync(repositoryPath(DEPLOY_RUNBOOK))).toBe(true);
    [
      GATE_COMMAND,
      DEPLOY_RUNBOOK,
      DEPLOY_SCRIPT,
      RELEASE_COMMAND,
      RELEASE_CONDITION,
      HIGHEST_TAG_WORDS,
      FIRST_RELEASE_WORDS,
      ...PRODUCTION_CHECKS,
    ].forEach((mention) => expect(body).toContain(mention));
  });

  test('stops at the first failure, keeps the previous release live and never touches the release folder or the rollback by hand', () => {
    const body = bodyOf(skill());
    [...STOP_SENTENCES, NOT_LIVE_SENTENCE, ...FORBIDDEN_SENTENCES].forEach((sentence) => expect(body).toContain(sentence));
  });

  test('is named in the skills index, the harness layout and the harness table, and the runbook says agents run it through the skill', () => {
    expect(readRepositoryFile(SKILLS_README)).toContain(SKILL_NAME);
    const harness = readRepositoryFile(HARNESS_FILE);
    expect(harness.split('\n').find((line) => line.startsWith(HARNESS_LAYOUT_LINE))).toContain(SKILL_NAME);
    expect(harness).toContain(HARNESS_TABLE_ROW);
    const purpose = readRepositoryFile(DEPLOY_RUNBOOK).split('\n').slice(0, DEPLOY_RUNBOOK_PURPOSE_LINES).join('\n');
    expect(purpose).toContain('`deploy` skill');
  });
});
