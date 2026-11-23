import { type HistoryEntry, OWNER_ACTOR, agentActor } from '@todz/core';
import { ActorKind, HistoryAction, TaskField, TaskState } from '@todz/types';
import { evictDurableObject, runInDurableObject } from 'cloudflare:test';
import { describe, expect, test } from 'vitest';
import { SqliteTaskStore } from '../src/sqlite-task-store';
import { AGENT_ACTOR, CLOCK_NOW, buildTask, calendarDate, newProjectStub } from './task-fixtures';

type StoreContext = { store: SqliteTaskStore; sql: SqlStorage };

const SECRET_TITLE = 'Row secret';
const BAD_STATE = 'archived';
const BAD_ACTION = 'deleted';
const BAD_FIELD = 'colour';

function inStore<Result>({ run }: { run: (context: StoreContext) => Result }): Promise<Result> {
  return runInDurableObject(newProjectStub(), (_instance, state) =>
    run({ store: new SqliteTaskStore(state.storage.sql), sql: state.storage.sql }),
  );
}

function messageOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    if (error instanceof Error) return error.message;
    throw error;
  }
  throw new Error('expected the call to throw');
}

function insertRawTask({
  sql,
  number,
  state = TaskState.Open,
  createdByKind = ActorKind.Owner,
  createdByClient = null,
}: {
  sql: SqlStorage;
  number: number;
  state?: string;
  createdByKind?: string;
  createdByClient?: string | null;
}): void {
  sql.exec(
    'INSERT INTO tasks (number, title, state, order_key, created_by_kind, created_by_client, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    number,
    SECRET_TITLE,
    state,
    'a0',
    createdByKind,
    createdByClient,
    CLOCK_NOW,
    CLOCK_NOW,
  );
}

function insertRawHistory({ sql, action, fields }: { sql: SqlStorage; action: string; fields: string }): void {
  sql.exec(
    'INSERT INTO task_history (task_number, at, actor_kind, actor_client, action, fields, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
    1,
    CLOCK_NOW,
    ActorKind.Owner,
    null,
    action,
    fields,
    null,
  );
}

describe('SqliteTaskStore', () => {
  test('an empty project has no tasks, no issued number and no matches', async () => {
    const result = await inStore({
      run: ({ store }) => ({
        lastIssued: store.lastIssuedTaskNumber(),
        open: store.listTasksInState(TaskState.Open),
        found: store.findTask(1),
        byKey: store.findTaskByIdempotencyKey('k1'),
      }),
    });
    expect(result).toEqual({ lastIssued: null, open: [], found: null, byKey: null });
  });

  test('a task with notes, a due date, a key and an agent creator round trips', async () => {
    const task = buildTask({
      notes: 'Some notes',
      dueDate: calendarDate('2026-11-30'),
      idempotencyKey: 'k1',
      createdBy: AGENT_ACTOR,
    });
    const found = await inStore({
      run: ({ store }) => {
        store.insertTask(task);
        return store.findTask(1);
      },
    });
    expect(found).toEqual(task);
  });

  test('a task without notes, due date or key and an owner creator round trips', async () => {
    const task = buildTask();
    const found = await inStore({
      run: ({ store }) => {
        store.insertTask(task);
        return store.findTask(1);
      },
    });
    expect(found).toEqual(task);
  });

  test('a replaced done task keeps its state and completion and moves between the state lists', async () => {
    const doneTask = buildTask({ state: TaskState.Done, completedAt: CLOCK_NOW + 1, updatedAt: CLOCK_NOW + 1 });
    const result = await inStore({
      run: ({ store }) => {
        store.insertTask(buildTask());
        store.replaceTask(doneTask);
        return { found: store.findTask(1), done: store.listTasksInState(TaskState.Done), open: store.listTasksInState(TaskState.Open) };
      },
    });
    expect(result).toEqual({ found: doneTask, done: [doneTask], open: [] });
  });

  test('the idempotency key lookup keeps case', async () => {
    const task = buildTask({ idempotencyKey: 'k1' });
    const result = await inStore({
      run: ({ store }) => {
        store.insertTask(task);
        return { exact: store.findTaskByIdempotencyKey('k1'), upper: store.findTaskByIdempotencyKey('K1') };
      },
    });
    expect(result).toEqual({ exact: task, upper: null });
  });

  test('open tasks come back in the order JavaScript sorts their order keys', async () => {
    const orderKeys = ['a1', 'Zz', 'a0V'];
    const listed = await inStore({
      run: ({ store }) => {
        orderKeys.forEach((orderKey, index) => store.insertTask(buildTask({ number: index + 1, orderKey })));
        return store.listTasksInState(TaskState.Open).map((task) => task.orderKey);
      },
    });
    expect(listed).toEqual([...orderKeys].sort());
  });

  test('the counter survives a task row that stopped existing', async () => {
    const lastIssued = await inStore({
      run: ({ store, sql }) => {
        store.insertTask(buildTask({ number: 1 }));
        store.insertTask(buildTask({ number: 2, orderKey: 'a1' }));
        sql.exec('DELETE FROM tasks WHERE number = 2');
        return store.lastIssuedTaskNumber();
      },
    });
    expect(lastIssued).toBe(2);
  });

  test('the counter never goes down when a lower number is inserted', async () => {
    const counters = await inStore({
      run: ({ store }) => {
        store.insertTask(buildTask({ number: 5 }));
        const afterFive = store.lastIssuedTaskNumber();
        store.insertTask(buildTask({ number: 3, orderKey: 'a1' }));
        return { afterFive, afterThree: store.lastIssuedTaskNumber() };
      },
    });
    expect(counters).toEqual({ afterFive: 5, afterThree: 5 });
  });

  test('history comes back in insertion order', async () => {
    const created: HistoryEntry = { at: CLOCK_NOW, actor: OWNER_ACTOR, action: HistoryAction.Created, fields: [], note: null };
    const updated: HistoryEntry = {
      at: CLOCK_NOW + 1,
      actor: agentActor('Claude Code'),
      action: HistoryAction.Updated,
      fields: [TaskField.Title, TaskField.DueDate],
      note: 'moved to Friday',
    };
    const history = await inStore({
      run: ({ store }) => {
        store.insertTask(buildTask());
        store.appendHistory({ number: 1, entry: created });
        store.appendHistory({ number: 1, entry: updated });
        return store.listHistory(1);
      },
    });
    expect(history).toEqual([created, updated]);
  });

  describe('a row that does not map', () => {
    test.each([
      { name: 'an unknown state', row: { state: BAD_STATE }, column: 'tasks.state', badValue: BAD_STATE },
      {
        name: 'an agent without a client',
        row: { createdByKind: ActorKind.Agent },
        column: 'tasks.created_by_client',
        badValue: ActorKind.Agent,
      },
      {
        name: 'an owner with a client',
        row: { createdByKind: ActorKind.Owner, createdByClient: 'Claude Code' },
        column: 'tasks.created_by_client',
        badValue: 'Claude Code',
      },
    ])('findTask throws for $name and names only the column and the task number', async ({ row, column, badValue }) => {
      const message = await inStore({
        run: ({ store, sql }) => {
          insertRawTask({ sql, number: 1, ...row });
          return messageOf(() => store.findTask(1));
        },
      });
      expect(message).toContain(column);
      expect(message).toContain('1');
      expect(message).not.toContain(SECRET_TITLE);
      expect(message).not.toContain(badValue);
    });

    test.each([
      { name: 'an unknown action', action: BAD_ACTION, fields: '[]', column: 'task_history.action', badValue: BAD_ACTION },
      {
        name: 'an unknown field',
        action: HistoryAction.Created,
        fields: `["${BAD_FIELD}"]`,
        column: 'task_history.fields',
        badValue: BAD_FIELD,
      },
      {
        name: 'fields that are not JSON',
        action: HistoryAction.Created,
        fields: SECRET_TITLE,
        column: 'task_history.fields',
        badValue: SECRET_TITLE,
      },
    ])('listHistory throws for $name and names only the column and the task number', async ({ action, fields, column, badValue }) => {
      const message = await inStore({
        run: ({ store, sql }) => {
          insertRawTask({ sql, number: 1 });
          insertRawHistory({ sql, action, fields });
          return messageOf(() => store.listHistory(1));
        },
      });
      expect(message).toContain(column);
      expect(message).toContain('1');
      expect(message).not.toContain(SECRET_TITLE);
      expect(message).not.toContain(badValue);
    });
  });

  test('the schema survives eviction', async () => {
    const stub = newProjectStub();
    await runInDurableObject(stub, (_instance, state) => new SqliteTaskStore(state.storage.sql).insertTask(buildTask()));
    await evictDurableObject(stub);
    const found = await runInDurableObject(stub, (_instance, state) => new SqliteTaskStore(state.storage.sql).findTask(1));
    expect(found).toEqual(buildTask());
  });

  test('the schema is applied once', async () => {
    const stub = newProjectStub();
    await runInDurableObject(stub, (_instance, state) => new SqliteTaskStore(state.storage.sql).insertTask(buildTask()));
    await evictDurableObject(stub);
    const counts = await runInDurableObject(stub, (_instance, state) => ({
      versions: state.storage.sql.exec<{ version: number }>('SELECT version FROM schema_version').toArray(),
      counters: state.storage.sql.exec('SELECT last_issued_number FROM task_counter').toArray().length,
    }));
    expect(counts.versions).toEqual([{ version: 1 }]);
    expect(counts.counters).toBeLessThanOrEqual(1);
  });
});
