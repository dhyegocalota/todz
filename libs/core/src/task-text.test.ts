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
const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b);
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);
const ZERO_WIDTH_JOINER = String.fromCharCode(0x200d);
const FAMILY_EMOJI = ['👨', '👩', '👧'].join(ZERO_WIDTH_JOINER);

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

  test.each([ZERO_WIDTH_SPACE, ` ${ZERO_WIDTH_SPACE}${ZERO_WIDTH_JOINER} `, BYTE_ORDER_MARK])(
    'a title of whitespace and format characters only (%j) is TitleEmpty',
    (text) => {
      expect(violationIssueOf(() => normalizeTitle(text))).toBe(RuleIssue.TitleEmpty);
    },
  );

  test('a joined emoji title keeps its zero-width joiners', () => {
    expect(normalizeTitle(FAMILY_EMOJI)).toBe(FAMILY_EMOJI);
  });

  test('the length is checked after the whitespace collapses', () => {
    expect(normalizeTitle(`${'a'.repeat(TASK_TITLE_MAX_LENGTH)}   `)).toHaveLength(TASK_TITLE_MAX_LENGTH);
  });
});

describe('control characters and oversized input', () => {
  const terminalEscape = `Pay ${String.fromCharCode(0x1b)}]52;c;AAAA${String.fromCharCode(0x07)} rent`;
  const nullCharacter = String.fromCharCode(0);
  const deleteCharacter = String.fromCharCode(0x7f);
  const nextLine = String.fromCharCode(0x85);
  const carriageReturn = String.fromCharCode(0x0d);

  test.each([terminalEscape, `a${nullCharacter}b`, `a${deleteCharacter}b`, `a${nextLine}b`])('a title with %j is TitleInvalid', (text) => {
    expect(violationIssueOf(() => normalizeTitle(text))).toBe(RuleIssue.TitleInvalid);
  });

  test.each([terminalEscape, `a${nullCharacter}b`, `a${deleteCharacter}b`])('a name with %j is NameInvalid', (text) => {
    expect(violationIssueOf(() => normalizeName(text))).toBe(RuleIssue.NameInvalid);
  });

  test.each([terminalEscape, `a${nullCharacter}b`, `a${deleteCharacter}b`, `a${carriageReturn}b`, `a${nextLine}b`])(
    'notes with %j are NotesInvalid',
    (text) => {
      expect(violationIssueOf(() => normalizeNotes(text))).toBe(RuleIssue.NotesInvalid);
    },
  );

  test.each([terminalEscape, `a${nullCharacter}b`, `a${carriageReturn}b`])('a completion note with %j is CompletionNoteInvalid', (text) => {
    expect(violationIssueOf(() => normalizeCompletionNote(text))).toBe(RuleIssue.CompletionNoteInvalid);
  });

  test('notes keep line feeds and tabs and turn CRLF into LF', () => {
    expect(normalizeNotes('a\n\tb\r\nc')).toBe('a\n\tb\nc');
  });

  test('an invalid-character message holds the issue only', () => {
    expect(violationMessageOf(() => normalizeTitle(`${SENTINEL}${nullCharacter}`))).not.toContain(SENTINEL);
    expect(violationMessageOf(() => normalizeNotes(`${SENTINEL}${nullCharacter}`))).not.toContain(SENTINEL);
  });

  test.each([
    { name: 'title', run: (text: string) => normalizeTitle(text), limit: TASK_TITLE_MAX_LENGTH, issue: RuleIssue.TitleTooLong },
    { name: 'notes', run: (text: string) => normalizeNotes(text), limit: TASK_NOTES_MAX_LENGTH, issue: RuleIssue.NotesTooLong },
    {
      name: 'completion note',
      run: (text: string) => normalizeCompletionNote(text),
      limit: COMPLETION_NOTE_MAX_LENGTH,
      issue: RuleIssue.CompletionNoteTooLong,
    },
    { name: 'name', run: (text: string) => normalizeName(text), limit: NAME_MAX_LENGTH, issue: RuleIssue.NameTooLong },
  ])('a $name of limit * 2 + 1 ASCII characters is rejected as too long', ({ run, limit, issue }) => {
    expect(violationIssueOf(() => run('a'.repeat(limit * 2 + 1)))).toBe(issue);
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

  test('exactly the limit is accepted and one character more is NotesTooLong', () => {
    expect(normalizeNotes('a'.repeat(TASK_NOTES_MAX_LENGTH))).toHaveLength(TASK_NOTES_MAX_LENGTH);
    expect(violationIssueOf(() => normalizeNotes('a'.repeat(TASK_NOTES_MAX_LENGTH + 1)))).toBe(RuleIssue.NotesTooLong);
  });

  test('the limit counts code points, not bytes, so 20000 emoji fit and 20001 do not', () => {
    expect(normalizeNotes(EMOJI.repeat(TASK_NOTES_MAX_LENGTH))).toHaveLength(EMOJI.length * TASK_NOTES_MAX_LENGTH);
    expect(violationIssueOf(() => normalizeNotes(EMOJI.repeat(TASK_NOTES_MAX_LENGTH + 1)))).toBe(RuleIssue.NotesTooLong);
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

  test.each(['', ZERO_WIDTH_SPACE, ` ${ZERO_WIDTH_SPACE} `])('a blank or invisible name (%j) is NameEmpty', (text) => {
    expect(violationIssueOf(() => normalizeName(text))).toBe(RuleIssue.NameEmpty);
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
