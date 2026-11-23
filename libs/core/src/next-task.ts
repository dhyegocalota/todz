import type { TaskStore } from './ports';
import type { CalendarDate, Task } from './task';

export function nextTask({ store, today }: { store: TaskStore; today: CalendarDate }): Task | null {
  throw new Error('nextTask is not implemented');
}
