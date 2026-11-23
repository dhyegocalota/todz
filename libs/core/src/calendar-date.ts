import { DueWindow } from '@todz/types';
import type { CalendarDate } from './task';

const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const YEAR_GROUP = 1;
const MONTH_GROUP = 2;
const DAY_GROUP = 3;
const FIRST_MONTH = 1;
const LAST_MONTH = 12;
const LAST_DAY_OF_PREVIOUS_MONTH = 0;
const FIRST_DAY = 1;

function daysInMonth({ year, month }: { year: number; month: number }): number {
  const lastDayOfMonth = new Date(0);
  lastDayOfMonth.setUTCFullYear(year, month, LAST_DAY_OF_PREVIOUS_MONTH);
  return lastDayOfMonth.getUTCDate();
}

export function parseCalendarDate(text: string): CalendarDate | null {
  const match = CALENDAR_DATE_PATTERN.exec(text);
  if (!match) return null;
  const year = Number(match[YEAR_GROUP]);
  const month = Number(match[MONTH_GROUP]);
  const day = Number(match[DAY_GROUP]);
  const isRealMonth = month >= FIRST_MONTH && month <= LAST_MONTH;
  if (!isRealMonth) return null;
  const isRealDay = day >= FIRST_DAY && day <= daysInMonth({ year, month });
  if (!isRealDay) return null;
  return text as CalendarDate;
}

export function dueWindowOf({ dueDate, today }: { dueDate: CalendarDate | null; today: CalendarDate }): DueWindow {
  if (dueDate === null) return DueWindow.Undated;
  if (dueDate < today) return DueWindow.Overdue;
  if (dueDate === today) return DueWindow.Today;
  return DueWindow.Upcoming;
}
