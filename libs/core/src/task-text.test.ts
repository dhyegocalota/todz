import {
  COMPLETION_NOTE_MAX_LENGTH,
  IDEMPOTENCY_KEY_MAX_LENGTH,
  NAME_MAX_LENGTH,
  RuleIssue,
  TASK_NOTES_MAX_LENGTH,
  TASK_TITLE_MAX_LENGTH,
} from '@todz/types';
import { describe, expect, test } from 'vitest';
import { normalizeCompletionNote, normalizeIdempotencyKey, normalizeName, normalizeNotes, normalizeTitle, textMatches } from './task-text';
import { violationIssueOf, violationMessageOf } from './test-support';

const SENTINEL = 'SENTINEL-CONTENT';
const EMOJI = '😀';

describe('normalizeTitle', () => {
  test('trims and collapses every whitespace run into one space', () => {
    expect(normalizeTitle('  Fix\n the   login ')).toBe('Fix the login');
  });

  test('a blank title is TitleEmpty', () => {
    expect(violationIssueOf(() => normalizeTitle('   '))).toBe(RuleIssue.TitleEmpty);
  });

  test('over the limit is TitleTooLong and the message holds no title text', () => {
    const tooLong = `${SENTINEL}${'a'.repeat(TASK_TITLE_MAX_LENGTH)}`;
    expect(violationIssueOf(() => normalizeTitle(tooLong))).toBe(RuleIssue.TitleTooLong);
    expect(violationMessageOf(() => normalizeTitle(tooLong))).not.toContain(SENTINEL);
  });

  test('the limit counts code points, so 200 emoji are accepted and 201 are not', () => {
    expect(normalizeTitle(EMOJI.repeat(TASK_TITLE_MAX_LENGTH))).toHaveLength(TASK_TITLE_MAX_LENGTH * EMOJI.length);
    expect(violationIssueOf(() => normalizeTitle(EMOJI.repeat(TASK_TITLE_MAX_LENGTH + 1)))).toBe(RuleIssue.TitleTooLong);
  });

  test('the length is checked after the whitespace collapses', () => {
    expect(normalizeTitle(`${'a'.repeat(TASK_TITLE_MAX_LENGTH)}   `)).toHaveLength(TASK_TITLE_MAX_LENGTH);
  });
});

describe('normalizeNotes', () => {
  test.each([null, '', '  \n '])('%j becomes null', (text) => {
    expect(normalizeNotes(text)).toBeNull();
  });

  test('CRLF becomes LF', () => {
    expect(normalizeNotes('a\r\nb')).toBe('a\nb');
  });

  test('indentation is kept', () => {
    expect(normalizeNotes('    code')).toBe('    code');
  });

  test('over the limit is NotesTooLong and the message holds no notes text', () => {
    const tooLong = `${SENTINEL}${'a'.repeat(TASK_NOTES_MAX_LENGTH)}`;
    expect(violationIssueOf(() => normalizeNotes(tooLong))).toBe(RuleIssue.NotesTooLong);
    expect(violationMessageOf(() => normalizeNotes(tooLong))).not.toContain(SENTINEL);
  });

  test('exactly the limit is accepted', () => {
    expect(normalizeNotes('a'.repeat(TASK_NOTES_MAX_LENGTH))).toHaveLength(TASK_NOTES_MAX_LENGTH);
  });
});

describe('normalizeCompletionNote', () => {
  test('null and blank become null', () => {
    expect(normalizeCompletionNote(null)).toBeNull();
    expect(normalizeCompletionNote('  ')).toBeNull();
  });

  test('keeps the note as written with LF line breaks', () => {
    expect(normalizeCompletionNote('shipped\r\nin #4')).toBe('shipped\nin #4');
  });

  test('over the limit is CompletionNoteTooLong and the message holds no note text', () => {
    const tooLong = `${SENTINEL}${'a'.repeat(COMPLETION_NOTE_MAX_LENGTH)}`;
    expect(violationIssueOf(() => normalizeCompletionNote(tooLong))).toBe(RuleIssue.CompletionNoteTooLong);
    expect(violationMessageOf(() => normalizeCompletionNote(tooLong))).not.toContain(SENTINEL);
  });
});

describe('normalizeName', () => {
  test('trims and collapses whitespace', () => {
    expect(normalizeName('  Logic   Bit ')).toBe('Logic Bit');
  });

  test('a blank name is NameEmpty', () => {
    expect(violationIssueOf(() => normalizeName(''))).toBe(RuleIssue.NameEmpty);
  });

  test('over the limit is NameTooLong', () => {
    expect(violationIssueOf(() => normalizeName('a'.repeat(NAME_MAX_LENGTH + 1)))).toBe(RuleIssue.NameTooLong);
  });

  test('exactly the limit is accepted', () => {
    expect(normalizeName('a'.repeat(NAME_MAX_LENGTH))).toHaveLength(NAME_MAX_LENGTH);
  });
});

describe('normalizeIdempotencyKey', () => {
  test('null stays null', () => {
    expect(normalizeIdempotencyKey(null)).toBeNull();
  });

  test('a valid key is kept exactly', () => {
    expect(normalizeIdempotencyKey('run-42:a.b_C')).toBe('run-42:a.b_C');
  });

  test.each([' k1', 'k 1', '', 'é', 'a'.repeat(IDEMPOTENCY_KEY_MAX_LENGTH + 1)])('rejects %j', (text) => {
    expect(violationIssueOf(() => normalizeIdempotencyKey(text))).toBe(RuleIssue.IdempotencyKeyInvalid);
  });

  test('exactly the limit is accepted', () => {
    expect(normalizeIdempotencyKey('a'.repeat(IDEMPOTENCY_KEY_MAX_LENGTH))).toHaveLength(IDEMPOTENCY_KEY_MAX_LENGTH);
  });
});

describe('textMatches', () => {
  test('ignores case and accents on both sides', () => {
    expect(textMatches({ text: 'Reunião com Ana', search: 'reuniao' })).toBe(true);
    expect(textMatches({ text: 'REUNIÃO', search: 'reunião' })).toBe(true);
  });

  test('matches inside the text', () => {
    expect(textMatches({ text: 'Fix the login', search: 'the log' })).toBe(true);
  });

  test('matches accents typed as combining marks against precomposed text and capitals', () => {
    expect(textMatches({ text: 'Reunião', search: 'reunião' })).toBe(true);
    expect(textMatches({ text: 'Reunião', search: 'REUNIAO' })).toBe(true);
  });

  test('folds case and accents only, so ß does not match ss', () => {
    expect(textMatches({ text: 'Straße', search: 'strasse' })).toBe(false);
  });

  test('is false when the text does not contain the search', () => {
    expect(textMatches({ text: 'Fix the login', search: 'logout' })).toBe(false);
  });
});
