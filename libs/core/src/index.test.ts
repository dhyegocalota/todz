import { describe, expect, test } from 'vitest';
import * as core from './index';

const PUBLIC_EXPORTS = [
  'LimitViolation',
  'OWNER_ACTOR',
  'RuleViolation',
  'TaskNotFoundError',
  'addTasks',
  'agentActor',
  'assertBatchSize',
  'completeTasks',
  'deleteTask',
  'dueNow',
  'dueWindowOf',
  'formatShortId',
  'listTasks',
  'nextTask',
  'normalizeCompletionNote',
  'normalizeDueDate',
  'normalizeIdempotencyKey',
  'normalizeName',
  'normalizeNotes',
  'normalizeTitle',
  'orderKeyBetween',
  'parseCalendarDate',
  'parseShortId',
  'reopenTasks',
  'textMatches',
  'updateTask',
  'validateDrafts',
];

describe('the package index', () => {
  test('exports every public function and error', () => {
    expect(Object.keys(core).sort()).toEqual(PUBLIC_EXPORTS);
  });

  test('does not export the in-memory store', () => {
    expect(Object.keys(core)).not.toContain('InMemoryTaskStore');
  });
});
