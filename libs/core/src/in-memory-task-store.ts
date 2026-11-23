import type { TaskState } from '@todz/types';
import type { TaskStore } from './ports';
import type { HistoryEntry, Task } from './task';

const NO_TASK_ISSUED = 0;

export class InMemoryTaskStore implements TaskStore {
  private readonly tasks = new Map<number, Task>();
  private readonly histories = new Map<number, HistoryEntry[]>();
  private highestIssuedNumber = NO_TASK_ISSUED;
  writeCount = 0;

  findTask(number: number): Task | null {
    const task = this.tasks.get(number);
    return task ? structuredClone(task) : null;
  }

  findTaskByIdempotencyKey(idempotencyKey: string): Task | null {
    const task = [...this.tasks.values()].find((candidate) => candidate.idempotencyKey === idempotencyKey);
    return task ? structuredClone(task) : null;
  }

  listTasksInState(state: TaskState): Task[] {
    return [...this.tasks.values()].filter((task) => task.state === state).map((task) => structuredClone(task));
  }

  lastIssuedTaskNumber(): number | null {
    return this.highestIssuedNumber === NO_TASK_ISSUED ? null : this.highestIssuedNumber;
  }

  insertTask(task: Task): void {
    this.writeCount += 1;
    this.tasks.set(task.number, structuredClone(task));
    this.histories.set(task.number, []);
    this.highestIssuedNumber = Math.max(this.highestIssuedNumber, task.number);
  }

  replaceTask(task: Task): void {
    this.writeCount += 1;
    this.tasks.set(task.number, structuredClone(task));
  }

  appendHistory({ number, entry }: { number: number; entry: HistoryEntry }): void {
    this.writeCount += 1;
    this.histories.set(number, [...this.historyOf(number), structuredClone(entry)]);
  }

  allTasks(): Task[] {
    return [...this.tasks.values()].map((task) => structuredClone(task));
  }

  historyOf(number: number): HistoryEntry[] {
    const history = this.histories.get(number);
    if (!history) throw new Error(`no history for task ${number}`);
    return history;
  }
}
