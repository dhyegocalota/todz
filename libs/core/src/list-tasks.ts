import { type DueWindow, LIST_LIMIT_MAX, RuleIssue, SEARCH_TEXT_MAX_LENGTH, TaskState } from '@todz/types';
import { dueWindowOf } from './calendar-date';
import { RuleViolation } from './errors';
import type { TaskStore } from './ports';
import { compareOrderKeys } from './project-tasks';
import type { CalendarDate, Task, TaskFilter } from './task';
import { exceedsCodePointLimit, textMatches } from './task-text';

const MINIMUM_LIMIT = 1;

export type TaskList = { tasks: Task[]; totalMatched: number };

function completedAtOf(task: Task): number {
  if (task.completedAt === null) throw new Error(`done task ${task.number} has no completedAt`);
  return task.completedAt;
}

function compareNewestCompletedFirst(left: Task, right: Task): number {
  const completedAtDifference = completedAtOf(right) - completedAtOf(left);
  if (completedAtDifference !== 0) return completedAtDifference;
  return right.number - left.number;
}

const COMPARATOR_OF_STATE: Record<TaskState, (left: Task, right: Task) => number> = {
  [TaskState.Open]: compareOrderKeys,
  [TaskState.Done]: compareNewestCompletedFirst,
};

function validateFilter(filter: TaskFilter): string | null {
  const isValidLimit = Number.isInteger(filter.limit) && filter.limit >= MINIMUM_LIMIT && filter.limit <= LIST_LIMIT_MAX;
  if (!isValidLimit) throw new RuleViolation({ issue: RuleIssue.LimitInvalid });
  if (filter.text === null) return null;
  const searchText = filter.text.trim();
  if (exceedsCodePointLimit({ text: searchText, maxLength: SEARCH_TEXT_MAX_LENGTH }))
    throw new RuleViolation({ issue: RuleIssue.SearchTextTooLong });
  if (searchText === '') return null;
  return searchText;
}

function matchesFilter({
  task,
  today,
  dueWindows,
  searchText,
}: {
  task: Task;
  today: CalendarDate;
  dueWindows: DueWindow[];
  searchText: string | null;
}): boolean {
  const matchesWindow = dueWindows.length === 0 || dueWindows.includes(dueWindowOf({ dueDate: task.dueDate, today }));
  if (!matchesWindow) return false;
  if (searchText === null) return true;
  const matchesTitle = textMatches({ text: task.title, search: searchText });
  const matchesNotes = task.notes !== null && textMatches({ text: task.notes, search: searchText });
  return matchesTitle || matchesNotes;
}

export function listTasks({ store, today, filter }: { store: TaskStore; today: CalendarDate; filter: TaskFilter }): TaskList {
  const searchText = validateFilter(filter);
  const matched = store
    .listTasksInState(filter.state)
    .filter((task) => matchesFilter({ task, today, dueWindows: filter.dueWindows, searchText }))
    .sort(COMPARATOR_OF_STATE[filter.state]);
  return { tasks: matched.slice(0, filter.limit), totalMatched: matched.length };
}
