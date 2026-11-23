import type { DueWindow } from '@todz/types';
import type { CalendarDate } from './task';

export function parseCalendarDate(text: string): CalendarDate | null {
  throw new Error('parseCalendarDate is not implemented');
}

export function dueWindowOf({ dueDate, today }: { dueDate: CalendarDate | null; today: CalendarDate }): DueWindow {
  throw new Error('dueWindowOf is not implemented');
}
