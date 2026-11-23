export enum TaskState {
  Open = 'open',
  Done = 'done',
}

export enum ActorKind {
  Owner = 'owner',
  Agent = 'agent',
}

export enum TaskField {
  Title = 'title',
  Notes = 'notes',
  DueDate = 'due_date',
  Order = 'order',
}

export enum HistoryAction {
  Created = 'created',
  Updated = 'updated',
  Completed = 'completed',
  Reopened = 'reopened',
}

export enum DueWindow {
  Overdue = 'overdue',
  Today = 'today',
  Upcoming = 'upcoming',
  Undated = 'undated',
}

export enum TaskPlacement {
  First = 'first',
  Last = 'last',
  Before = 'before',
  After = 'after',
}

export enum RuleIssue {
  TitleEmpty = 'title_empty',
  TitleTooLong = 'title_too_long',
  NotesTooLong = 'notes_too_long',
  CompletionNoteTooLong = 'completion_note_too_long',
  DueDateInvalid = 'due_date_invalid',
  BatchEmpty = 'batch_empty',
  BatchTooLarge = 'batch_too_large',
  IdempotencyKeyInvalid = 'idempotency_key_invalid',
  ClientNameInvalid = 'client_name_invalid',
  NothingToUpdate = 'nothing_to_update',
  PlacementAnchorInvalid = 'placement_anchor_invalid',
  SearchTextTooLong = 'search_text_too_long',
  LimitInvalid = 'limit_invalid',
  NameEmpty = 'name_empty',
  NameTooLong = 'name_too_long',
}

export const TASK_SHORT_ID_PREFIX = 'T-';
export const TASK_TITLE_MAX_LENGTH = 200;
export const TASK_NOTES_MAX_LENGTH = 20_000;
export const COMPLETION_NOTE_MAX_LENGTH = 2_000;
export const IDEMPOTENCY_KEY_MAX_LENGTH = 128;
export const CLIENT_NAME_MAX_LENGTH = 64;
export const TASK_BATCH_MAX_SIZE = 50;
export const LIST_LIMIT_MAX = 100;
export const SEARCH_TEXT_MAX_LENGTH = 200;
export const NAME_MAX_LENGTH = 80;
export const INBOX_PROJECT_NAME = 'Inbox';
