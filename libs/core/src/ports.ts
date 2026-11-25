import type { TaskState } from '@todz/types';
import type { HistoryEntry, Task } from './task';

// NB ADR 0010: the store is synchronous and the caller wraps a use case in its own transaction.
export interface TaskStore {
  findTask(number: number): Task | null;
  findTaskByIdempotencyKey(idempotencyKey: string): Task | null;
  listTasksInState(state: TaskState): Task[];
  lastIssuedTaskNumber(): number | null;
  firstOrderKey({ excludingNumber }: { excludingNumber: number }): string | null;
  lastOrderKey({ excludingNumber }: { excludingNumber: number }): string | null;
  orderKeyBefore({ orderKey, excludingNumber }: { orderKey: string; excludingNumber: number }): string | null;
  orderKeyAfter({ orderKey, excludingNumber }: { orderKey: string; excludingNumber: number }): string | null;
  insertTask(task: Task): void;
  replaceTask(task: Task): void;
  appendHistory({ number, entry }: { number: number; entry: HistoryEntry }): void;
}

export interface Clock {
  now(): number;
}
