import { DueWindow, TaskState } from '@todz/types';
import { dueWindowOf } from './calendar-date';
import type { TaskStore } from './ports';
import { SORTS_AFTER, SORTS_BEFORE, SORTS_EQUAL, compareOrderKeys } from './project-tasks';
import type { CalendarDate, Task } from './task';

const RANK_DUE_NOW = 0;
const RANK_UNDATED = 1;
const RANK_UPCOMING = 2;

const RANK_OF_WINDOW: Record<DueWindow, number> = {
  [DueWindow.Overdue]: RANK_DUE_NOW,
  [DueWindow.Today]: RANK_DUE_NOW,
  [DueWindow.Undated]: RANK_UNDATED,
  [DueWindow.Upcoming]: RANK_UPCOMING,
};

function compareDueDates(left: Task, right: Task): number {
  if (left.dueDate === null || right.dueDate === null) return SORTS_EQUAL;
  if (left.dueDate < right.dueDate) return SORTS_BEFORE;
  if (left.dueDate > right.dueDate) return SORTS_AFTER;
  return SORTS_EQUAL;
}

function rankOf({ task, today }: { task: Task; today: CalendarDate }): number {
  return RANK_OF_WINDOW[dueWindowOf({ dueDate: task.dueDate, today })];
}

export function nextTask({ store, today }: { store: TaskStore; today: CalendarDate }): Task | null {
  const [first] = store.listTasksInState(TaskState.Open).sort((left, right) => {
    const rankDifference = rankOf({ task: left, today }) - rankOf({ task: right, today });
    if (rankDifference !== SORTS_EQUAL) return rankDifference;
    const dueDateOrder = compareDueDates(left, right);
    if (dueDateOrder !== SORTS_EQUAL) return dueDateOrder;
    return compareOrderKeys(left, right);
  });
  if (first === undefined) return null;
  return first;
}
