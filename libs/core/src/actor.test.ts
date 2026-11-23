import { ActorKind, CLIENT_NAME_MAX_LENGTH, RuleIssue } from '@todz/types';
import { describe, expect, test } from 'vitest';
import { OWNER_ACTOR, agentActor } from './actor';
import { RuleViolation } from './errors';

function violationIssueOf(run: () => unknown): RuleIssue {
  try {
    run();
  } catch (error) {
    if (error instanceof RuleViolation) return error.issue;
    throw error;
  }
  throw new Error('expected a RuleViolation');
}

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

  test.each(['', '   ', 'a'.repeat(CLIENT_NAME_MAX_LENGTH + 1), 'Claude\nCode', 'Claude\u0000Code'])('rejects %j', (clientName) => {
    expect(violationIssueOf(() => agentActor(clientName))).toBe(RuleIssue.ClientNameInvalid);
  });
});
