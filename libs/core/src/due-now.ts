import type { TaskStore } from './ports';
import type { CalendarDate } from './task';

export type DueNow = { count: number; overdue: number };

export function dueNow(_: { store: TaskStore; today: CalendarDate }): DueNow {
  throw new Error('dueNow is not implemented');
}
