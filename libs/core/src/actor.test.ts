import { ActorKind, CLIENT_NAME_MAX_LENGTH, RuleIssue } from '@todz/types';
import { describe, expect, test } from 'vitest';
import { OWNER_ACTOR, agentActor } from './actor';
import { violationIssueOf } from './test-support';

const PADDING_LENGTH = 100_000;
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

describe('OWNER_ACTOR', () => {
  test('is the owner kind', () => {
    expect(OWNER_ACTOR).toEqual({ kind: ActorKind.Owner });
  });
});

describe('agentActor', () => {
  test('trims the client name', () => {
    expect(agentActor(' Claude Code ')).toEqual({ kind: ActorKind.Agent, clientName: 'Claude Code' });
  });

  test('accepts exactly the limit in code points', () => {
    const clientName = '😀'.repeat(CLIENT_NAME_MAX_LENGTH);
    expect(agentActor(clientName)).toEqual({ kind: ActorKind.Agent, clientName });
  });

  test('a client name of limit * 2 + 1 ASCII characters is rejected', () => {
    expect(violationIssueOf(() => agentActor('a'.repeat(CLIENT_NAME_MAX_LENGTH * 2 + 1)))).toBe(RuleIssue.ClientNameInvalid);
  });

  test('a padded client name is checked against the budget before it is trimmed', () => {
    expect(violationIssueOf(() => agentActor(`${' '.repeat(PADDING_LENGTH)}Claude`))).toBe(RuleIssue.ClientNameInvalid);
  });

  test.each([
    '',
    '   ',
    'a'.repeat(CLIENT_NAME_MAX_LENGTH + 1),
    'Claude\nCode',
    'Claude\u0000Code',
    `Claude${LINE_SEPARATOR}Code`,
    `Claude${PARAGRAPH_SEPARATOR}Code`,
  ])('rejects %j', (clientName) => {
    expect(violationIssueOf(() => agentActor(clientName))).toBe(RuleIssue.ClientNameInvalid);
  });
});
