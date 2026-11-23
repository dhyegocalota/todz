import { describe, expect, test } from 'vitest';
import {
  ActorKind,
  CLIENT_NAME_MAX_LENGTH,
  COMPLETION_NOTE_MAX_LENGTH,
  DueWindow,
  HistoryAction,
  IDEMPOTENCY_KEY_MAX_LENGTH,
  INBOX_PROJECT_NAME,
  LIST_LIMIT_MAX,
  NAME_MAX_LENGTH,
  RuleIssue,
  SEARCH_TEXT_MAX_LENGTH,
  TASK_BATCH_MAX_SIZE,
  TASK_NOTES_MAX_LENGTH,
  TASK_SHORT_ID_PREFIX,
  TASK_TITLE_MAX_LENGTH,
  TaskField,
  TaskPlacement,
  TaskState,
} from './index';

describe('task enums', () => {
  test('TaskState', () => {
    expect({ ...TaskState }).toEqual({ Open: 'open', Done: 'done' });
  });

  test('ActorKind', () => {
    expect({ ...ActorKind }).toEqual({ Owner: 'owner', Agent: 'agent' });
  });

  test('TaskField', () => {
    expect({ ...TaskField }).toEqual({ Title: 'title', Notes: 'notes', DueDate: 'due_date', Order: 'order' });
  });

  test('HistoryAction', () => {
    expect({ ...HistoryAction }).toEqual({
      Created: 'created',
      Updated: 'updated',
      Completed: 'completed',
      Reopened: 'reopened',
    });
  });

  test('DueWindow', () => {
    expect({ ...DueWindow }).toEqual({
      Overdue: 'overdue',
      Today: 'today',
      Upcoming: 'upcoming',
      Undated: 'undated',
    });
  });

  test('TaskPlacement', () => {
    expect({ ...TaskPlacement }).toEqual({ First: 'first', Last: 'last', Before: 'before', After: 'after' });
  });

  test('RuleIssue', () => {
    expect({ ...RuleIssue }).toEqual({
      TitleEmpty: 'title_empty',
      TitleTooLong: 'title_too_long',
      NotesTooLong: 'notes_too_long',
      CompletionNoteTooLong: 'completion_note_too_long',
      DueDateInvalid: 'due_date_invalid',
      BatchEmpty: 'batch_empty',
      BatchTooLarge: 'batch_too_large',
      IdempotencyKeyInvalid: 'idempotency_key_invalid',
      ClientNameInvalid: 'client_name_invalid',
      TaskNumberInvalid: 'task_number_invalid',
      NothingToUpdate: 'nothing_to_update',
      PlacementAnchorInvalid: 'placement_anchor_invalid',
      SearchTextTooLong: 'search_text_too_long',
      LimitInvalid: 'limit_invalid',
      NameEmpty: 'name_empty',
      NameTooLong: 'name_too_long',
    });
  });
});

describe('task constants', () => {
  test('every limit and name equals the spec', () => {
    expect({
      TASK_SHORT_ID_PREFIX,
      TASK_TITLE_MAX_LENGTH,
      TASK_NOTES_MAX_LENGTH,
      COMPLETION_NOTE_MAX_LENGTH,
      IDEMPOTENCY_KEY_MAX_LENGTH,
      CLIENT_NAME_MAX_LENGTH,
      TASK_BATCH_MAX_SIZE,
      LIST_LIMIT_MAX,
      SEARCH_TEXT_MAX_LENGTH,
      NAME_MAX_LENGTH,
      INBOX_PROJECT_NAME,
    }).toEqual({
      TASK_SHORT_ID_PREFIX: 'T-',
      TASK_TITLE_MAX_LENGTH: 200,
      TASK_NOTES_MAX_LENGTH: 20_000,
      COMPLETION_NOTE_MAX_LENGTH: 2_000,
      IDEMPOTENCY_KEY_MAX_LENGTH: 128,
      CLIENT_NAME_MAX_LENGTH: 64,
      TASK_BATCH_MAX_SIZE: 50,
      LIST_LIMIT_MAX: 100,
      SEARCH_TEXT_MAX_LENGTH: 200,
      NAME_MAX_LENGTH: 80,
      INBOX_PROJECT_NAME: 'Inbox',
    });
  });
});
