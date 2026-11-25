import { DueWindow, TaskState } from '@todz/types';
import { dueWindowOf } from './calendar-date';
import type { TaskStore } from './ports';
import type { CalendarDate } from './task';

export type DueNow = { count: number; overdue: number };

export function dueNow({ store, today }: { store: TaskStore; today: CalendarDate }): DueNow {
  const windows = store.listTasksInState(TaskState.Open).map((task) => dueWindowOf({ dueDate: task.dueDate, today }));
  const overdue = windows.filter((window) => window === DueWindow.Overdue).length;
  const dueToday = windows.filter((window) => window === DueWindow.Today).length;
  return { count: overdue + dueToday, overdue };
}
