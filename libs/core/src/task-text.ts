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
const CONTROL_CHARACTER_PATTERN = /\p{Cc}/u;
const MULTILINE_CONTROL_CHARACTER_PATTERN = /(?![\n\t])\p{Cc}/u;
const COMBINING_MARK_PATTERN = /\p{M}/gu;
const IDEMPOTENCY_KEY_PATTERN = new RegExp(`^[A-Za-z0-9._:-]{1,${IDEMPOTENCY_KEY_MAX_LENGTH}}$`);
const MAX_UTF16_UNITS_PER_CODE_POINT = 2;
const SINGLE_SPACE = ' ';
const LINE_FEED = '\n';
const DECOMPOSED_FORM = 'NFD';

type SingleLineIssues = { empty: RuleIssue; tooLong: RuleIssue; invalid: RuleIssue };
type MultilineIssues = { tooLong: RuleIssue; invalid: RuleIssue };

export function exceedsUtf16Budget({ text, maxLength }: { text: string; maxLength: number }): boolean {
  return text.length > maxLength * MAX_UTF16_UNITS_PER_CODE_POINT;
}

export function exceedsCodePointLimit({ text, maxLength }: { text: string; maxLength: number }): boolean {
  if (exceedsUtf16Budget({ text, maxLength })) return true;
  return [...text].length > maxLength;
}

function normalizeSingleLine({ text, maxLength, issues }: { text: string; maxLength: number; issues: SingleLineIssues }): string {
  if (exceedsUtf16Budget({ text, maxLength })) throw new RuleViolation({ issue: issues.tooLong });
  const collapsed = text.trim().replace(WHITESPACE_RUN_PATTERN, SINGLE_SPACE);
  const visibleText = collapsed.replace(INVISIBLE_CHARACTER_PATTERN, '');
  if (visibleText === '') throw new RuleViolation({ issue: issues.empty });
  if (exceedsCodePointLimit({ text: collapsed, maxLength })) throw new RuleViolation({ issue: issues.tooLong });
  if (CONTROL_CHARACTER_PATTERN.test(collapsed)) throw new RuleViolation({ issue: issues.invalid });
  return collapsed;
}

function normalizeMultiline({
  text,
  maxLength,
  exceeds,
  issues,
}: {
  text: string | null;
  maxLength: number;
  exceeds: (lineFeedText: string) => boolean;
  issues: MultilineIssues;
}): string | null {
  if (text === null) return null;
  if (exceedsUtf16Budget({ text, maxLength })) throw new RuleViolation({ issue: issues.tooLong });
  if (text.trim() === '') return null;
  const lineFeedText = text.replace(CARRIAGE_RETURN_LINE_BREAK_PATTERN, LINE_FEED);
  if (exceeds(lineFeedText)) throw new RuleViolation({ issue: issues.tooLong });
  if (MULTILINE_CONTROL_CHARACTER_PATTERN.test(lineFeedText)) throw new RuleViolation({ issue: issues.invalid });
  return lineFeedText;
}

function foldText(text: string): string {
  return text.normalize(DECOMPOSED_FORM).replace(COMBINING_MARK_PATTERN, '').toLowerCase();
}

export function normalizeTitle(text: string): string {
  return normalizeSingleLine({
    text,
    maxLength: TASK_TITLE_MAX_LENGTH,
    issues: { empty: RuleIssue.TitleEmpty, tooLong: RuleIssue.TitleTooLong, invalid: RuleIssue.TitleInvalid },
  });
}

export function normalizeNotes(text: string | null): string | null {
  return normalizeMultiline({
    text,
    maxLength: TASK_NOTES_MAX_LENGTH,
    exceeds: (lineFeedText) => exceedsCodePointLimit({ text: lineFeedText, maxLength: TASK_NOTES_MAX_LENGTH }),
    issues: { tooLong: RuleIssue.NotesTooLong, invalid: RuleIssue.NotesInvalid },
  });
}

export function normalizeCompletionNote(text: string | null): string | null {
  return normalizeMultiline({
    text,
    maxLength: COMPLETION_NOTE_MAX_LENGTH,
    exceeds: (lineFeedText) => exceedsCodePointLimit({ text: lineFeedText, maxLength: COMPLETION_NOTE_MAX_LENGTH }),
    issues: { tooLong: RuleIssue.CompletionNoteTooLong, invalid: RuleIssue.CompletionNoteInvalid },
  });
}

export function normalizeName(text: string): string {
  return normalizeSingleLine({
    text,
    maxLength: NAME_MAX_LENGTH,
    issues: { empty: RuleIssue.NameEmpty, tooLong: RuleIssue.NameTooLong, invalid: RuleIssue.NameInvalid },
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
