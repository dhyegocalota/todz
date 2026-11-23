import {
  COMPLETION_NOTE_MAX_LENGTH,
  IDEMPOTENCY_KEY_MAX_LENGTH,
  NAME_MAX_LENGTH,
  RuleIssue,
  TASK_NOTES_MAX_LENGTH,
  TASK_TITLE_MAX_LENGTH,
} from '@todz/types';
import { RuleViolation } from './errors';

const WHITESPACE_RUN_PATTERN = /\s+/g;
const CARRIAGE_RETURN_LINE_BREAK_PATTERN = /\r\n/g;
const INVISIBLE_CHARACTER_PATTERN = /[\s\p{Cf}]/gu;
const COMBINING_MARK_PATTERN = /\p{M}/gu;
const IDEMPOTENCY_KEY_PATTERN = new RegExp(`^[A-Za-z0-9._:-]{1,${IDEMPOTENCY_KEY_MAX_LENGTH}}$`);
const SINGLE_SPACE = ' ';
const LINE_FEED = '\n';
const DECOMPOSED_FORM = 'NFD';

type SingleLineIssues = { empty: RuleIssue; tooLong: RuleIssue };

function codePointLength(text: string): number {
  return [...text].length;
}

function normalizeSingleLine({ text, maxLength, issues }: { text: string; maxLength: number; issues: SingleLineIssues }): string {
  const collapsed = text.trim().replace(WHITESPACE_RUN_PATTERN, SINGLE_SPACE);
  const visibleText = collapsed.replace(INVISIBLE_CHARACTER_PATTERN, '');
  if (visibleText === '') throw new RuleViolation({ issue: issues.empty });
  if (codePointLength(collapsed) > maxLength) throw new RuleViolation({ issue: issues.tooLong });
  return collapsed;
}

function normalizeMultiline({ text, maxLength, tooLong }: { text: string | null; maxLength: number; tooLong: RuleIssue }): string | null {
  if (text === null) return null;
  if (text.trim() === '') return null;
  const lineFeedText = text.replace(CARRIAGE_RETURN_LINE_BREAK_PATTERN, LINE_FEED);
  if (codePointLength(lineFeedText) > maxLength) throw new RuleViolation({ issue: tooLong });
  return lineFeedText;
}

function foldText(text: string): string {
  return text.normalize(DECOMPOSED_FORM).replace(COMBINING_MARK_PATTERN, '').toLowerCase();
}

export function normalizeTitle(text: string): string {
  return normalizeSingleLine({
    text,
    maxLength: TASK_TITLE_MAX_LENGTH,
    issues: { empty: RuleIssue.TitleEmpty, tooLong: RuleIssue.TitleTooLong },
  });
}

export function normalizeNotes(text: string | null): string | null {
  return normalizeMultiline({ text, maxLength: TASK_NOTES_MAX_LENGTH, tooLong: RuleIssue.NotesTooLong });
}

export function normalizeCompletionNote(text: string | null): string | null {
  return normalizeMultiline({ text, maxLength: COMPLETION_NOTE_MAX_LENGTH, tooLong: RuleIssue.CompletionNoteTooLong });
}

export function normalizeName(text: string): string {
  return normalizeSingleLine({
    text,
    maxLength: NAME_MAX_LENGTH,
    issues: { empty: RuleIssue.NameEmpty, tooLong: RuleIssue.NameTooLong },
  });
}

export function normalizeIdempotencyKey(text: string | null): string | null {
  if (text === null) return null;
  if (!IDEMPOTENCY_KEY_PATTERN.test(text)) throw new RuleViolation({ issue: RuleIssue.IdempotencyKeyInvalid });
  return text;
}

export function textMatches({ text, search }: { text: string; search: string }): boolean {
  return foldText(text).includes(foldText(search));
}
