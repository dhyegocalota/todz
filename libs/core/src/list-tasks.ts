import type { TaskStore } from './ports';
import type { CalendarDate, Task, TaskFilter } from './task';

export type TaskList = { tasks: Task[]; totalMatched: number };

export function listTasks({ store, today, filter }: { store: TaskStore; today: CalendarDate; filter: TaskFilter }): TaskList {
  throw new Error('listTasks is not implemented');
}
