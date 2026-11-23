import type { HistoryEntry, Task, TaskStore } from '@todz/core';
import type { TaskState } from '@todz/types';

export class SqliteTaskStore implements TaskStore {
  constructor(private readonly sql: SqlStorage) {}

  findTask(number: number): Task | null {
    throw new Error('SqliteTaskStore.findTask is not implemented');
  }

  findTaskByIdempotencyKey(idempotencyKey: string): Task | null {
    throw new Error('SqliteTaskStore.findTaskByIdempotencyKey is not implemented');
  }

  listTasksInState(state: TaskState): Task[] {
    throw new Error('SqliteTaskStore.listTasksInState is not implemented');
  }

  lastIssuedTaskNumber(): number | null {
    throw new Error('SqliteTaskStore.lastIssuedTaskNumber is not implemented');
  }

  insertTask(task: Task): void {
    throw new Error('SqliteTaskStore.insertTask is not implemented');
  }

  replaceTask(task: Task): void {
    throw new Error('SqliteTaskStore.replaceTask is not implemented');
  }

  appendHistory({ number, entry }: { number: number; entry: HistoryEntry }): void {
    throw new Error('SqliteTaskStore.appendHistory is not implemented');
  }

  listHistory(number: number): HistoryEntry[] {
    throw new Error('SqliteTaskStore.listHistory is not implemented');
  }
}
