import { DueWindow, RuleIssue } from '@todz/types';
import { describe, expect, test } from 'vitest';
import { dueWindowOf, normalizeDueDate, parseCalendarDate } from './calendar-date';
import type { CalendarDate } from './task';
import { violationIssueOf } from './test-support';

function calendarDate(text: string): CalendarDate {
  return text as CalendarDate;
}

describe('parseCalendarDate', () => {
  test.each(['2026-11-23', '2028-02-29', '2000-02-29', '2026-12-31'])('accepts %j', (text) => {
    expect(parseCalendarDate(text)).toBe(text);
  });

  test.each([
    '2026-02-29',
    '2026-13-01',
    '2026-11-31',
    '2026-1-5',
    '2026-11-23T00:00',
    '',
    '2100-02-29',
    '2026-00-10',
    '2026-11-00',
    ' 2026-11-23',
  ])('rejects %j', (text) => {
    expect(parseCalendarDate(text)).toBeNull();
  });
});

describe('normalizeDueDate', () => {
  test('null stays null', () => {
    expect(normalizeDueDate(null)).toBeNull();
  });

  test('a real day is kept', () => {
    expect(normalizeDueDate('2026-11-23')).toBe('2026-11-23');
  });

  test.each(['2026-02-30', '', 'tomorrow'])('rejects %j as DueDateInvalid', (text) => {
    expect(violationIssueOf(() => normalizeDueDate(text))).toBe(RuleIssue.DueDateInvalid);
  });
});

describe('dueWindowOf', () => {
  const today = calendarDate('2026-11-23');

  test('a task with no due date is undated', () => {
    expect(dueWindowOf({ dueDate: null, today })).toBe(DueWindow.Undated);
  });

  test('a date before today is overdue', () => {
    expect(dueWindowOf({ dueDate: calendarDate('2026-11-22'), today })).toBe(DueWindow.Overdue);
  });

  test('today is today', () => {
    expect(dueWindowOf({ dueDate: today, today })).toBe(DueWindow.Today);
  });

  test('a date after today is upcoming', () => {
    expect(dueWindowOf({ dueDate: calendarDate('2026-11-24'), today })).toBe(DueWindow.Upcoming);
  });

  test.each([
    { today: '2026-12-31', dueDate: '2027-01-01', expected: DueWindow.Upcoming },
    { today: '2027-01-01', dueDate: '2026-12-31', expected: DueWindow.Overdue },
    { today: '2026-02-28', dueDate: '2026-03-01', expected: DueWindow.Upcoming },
  ])('month and year ends: today $today, due $dueDate is $expected', ({ today: todayText, dueDate, expected }) => {
    expect(dueWindowOf({ dueDate: calendarDate(dueDate), today: calendarDate(todayText) })).toBe(expected);
  });
});
