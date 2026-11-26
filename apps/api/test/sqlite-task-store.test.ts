import { type HistoryEntry, OWNER_ACTOR, agentActor } from '@todz/core';
import { ActorKind, HistoryAction, PROJECT_OPEN_TASKS_MAX, TaskField, TaskState } from '@todz/types';
import { evictDurableObject, runInDurableObject } from 'cloudflare:test';
import { describe, expect, test } from 'vitest';
import { PROJECT_SCHEMA_VERSION } from '../src/project-schema';
import { SqliteTaskStore } from '../src/sqlite-task-store';
import { AGENT_ACTOR, CLOCK_NOW, buildTask, calendarDate, draftOf, newProjectStub, unwrap } from './task-fixtures';

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

  describe('the order key reads', () => {
    const NO_EXCLUDED_NUMBER = 0;
    const KEY_ABSENT_FROM_STORE = 'a3V';

    function insertTasks({ store, count }: { store: SqliteTaskStore; count: number }): void {
      Array.from({ length: count }, (_unused, index) => index + 1).forEach((number) =>
        store.insertTask(buildTask({ number, orderKey: `a${number}`, state: number % 2 === 0 ? TaskState.Done : TaskState.Open })),
      );
    }

    test('on an empty store every read answers null', async () => {
      const answers = await inStore({
        run: ({ store }) => [
          store.firstOrderKey({ excludingNumber: NO_EXCLUDED_NUMBER }),
          store.lastOrderKey({ excludingNumber: NO_EXCLUDED_NUMBER }),
          store.orderKeyBefore({ orderKey: 'a1', excludingNumber: NO_EXCLUDED_NUMBER }),
          store.orderKeyAfter({ orderKey: 'a1', excludingNumber: NO_EXCLUDED_NUMBER }),
        ],
      });
      expect(answers).toEqual([null, null, null, null]);
    });

    test('on one task the first and the last are its key until it is excluded, and it has no neighbour', async () => {
      const answers = await inStore({
        run: ({ store }) => {
          insertTasks({ store, count: 1 });
          return [
            store.firstOrderKey({ excludingNumber: NO_EXCLUDED_NUMBER }),
            store.lastOrderKey({ excludingNumber: NO_EXCLUDED_NUMBER }),
            store.firstOrderKey({ excludingNumber: 1 }),
            store.lastOrderKey({ excludingNumber: 1 }),
            store.orderKeyBefore({ orderKey: 'a1', excludingNumber: NO_EXCLUDED_NUMBER }),
            store.orderKeyAfter({ orderKey: 'a1', excludingNumber: NO_EXCLUDED_NUMBER }),
            store.orderKeyBefore({ orderKey: 'a2', excludingNumber: NO_EXCLUDED_NUMBER }),
            store.orderKeyAfter({ orderKey: 'a0', excludingNumber: NO_EXCLUDED_NUMBER }),
          ];
        },
      });
      expect(answers).toEqual(['a1', 'a1', null, null, null, null, 'a1', 'a1']);
    });

    test('on five tasks, open and done mixed, the first and the last are the smallest and the largest key of either state', async () => {
      const answers = await inStore({
        run: ({ store }) => {
          insertTasks({ store, count: 5 });
          return [
            store.firstOrderKey({ excludingNumber: NO_EXCLUDED_NUMBER }),
            store.lastOrderKey({ excludingNumber: NO_EXCLUDED_NUMBER }),
          ];
        },
      });
      expect(answers).toEqual(['a1', 'a5']);
    });

    test('excluding the first task the first read gives the second, and excluding the last the last read gives the fourth', async () => {
      const answers = await inStore({
        run: ({ store }) => {
          insertTasks({ store, count: 5 });
          return [
            store.firstOrderKey({ excludingNumber: 1 }),
            store.lastOrderKey({ excludingNumber: 5 }),
            store.firstOrderKey({ excludingNumber: 3 }),
            store.lastOrderKey({ excludingNumber: 3 }),
          ];
        },
      });
      expect(answers).toEqual(['a2', 'a4', 'a1', 'a5']);
    });

    test('the neighbour before a key is the largest smaller key and the neighbour after the smallest larger one', async () => {
      const answers = await inStore({
        run: ({ store }) => {
          insertTasks({ store, count: 5 });
          return [
            store.orderKeyBefore({ orderKey: 'a3', excludingNumber: NO_EXCLUDED_NUMBER }),
            store.orderKeyAfter({ orderKey: 'a3', excludingNumber: NO_EXCLUDED_NUMBER }),
            store.orderKeyBefore({ orderKey: 'a1', excludingNumber: NO_EXCLUDED_NUMBER }),
            store.orderKeyAfter({ orderKey: 'a5', excludingNumber: NO_EXCLUDED_NUMBER }),
            store.orderKeyBefore({ orderKey: KEY_ABSENT_FROM_STORE, excludingNumber: NO_EXCLUDED_NUMBER }),
            store.orderKeyAfter({ orderKey: KEY_ABSENT_FROM_STORE, excludingNumber: NO_EXCLUDED_NUMBER }),
          ];
        },
      });
      expect(answers).toEqual(['a2', 'a4', null, null, 'a3', 'a4']);
    });

    test('a neighbour read skips the excluded task', async () => {
      const answers = await inStore({
        run: ({ store }) => {
          insertTasks({ store, count: 5 });
          return [
            store.orderKeyBefore({ orderKey: 'a3', excludingNumber: 2 }),
            store.orderKeyAfter({ orderKey: 'a3', excludingNumber: 4 }),
            store.orderKeyBefore({ orderKey: 'a2', excludingNumber: 1 }),
            store.orderKeyAfter({ orderKey: 'a4', excludingNumber: 5 }),
          ];
        },
      });
      expect(answers).toEqual(['a1', 'a5', null, null]);
    });

    test('keys compare as JavaScript strings, so Zz sorts before a0V and a1', async () => {
      const answers = await inStore({
        run: ({ store }) => {
          ['a1', 'Zz', 'a0V'].forEach((orderKey, index) => store.insertTask(buildTask({ number: index + 1, orderKey })));
          return [
            store.firstOrderKey({ excludingNumber: NO_EXCLUDED_NUMBER }),
            store.lastOrderKey({ excludingNumber: NO_EXCLUDED_NUMBER }),
          ];
        },
      });
      expect(answers).toEqual(['Zz', 'a1']);
    });
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
    expect(counts.versions).toEqual([{ version: PROJECT_SCHEMA_VERSION }]);
    expect(counts.counters).toBeLessThanOrEqual(1);
  });
});

describe('SqliteTaskStore change numbers', () => {
  const FIRST_TASK = buildTask({ number: 1, title: 'First', orderKey: 'a0' });
  const SECOND_TASK = buildTask({ number: 2, title: 'Second', orderKey: 'a1' });
  const PAGE_LIMIT = 10;

  test('a project without writes has no change number and no changes', async () => {
    const result = await inStore({
      run: ({ store }) => ({ last: store.lastChangeNumber(), changes: store.listChangesSince({ cursor: 0, limit: PAGE_LIMIT }) }),
    });
    expect(result).toEqual({ last: null, changes: [] });
  });

  test('two inserts are stamped 1 and 2', async () => {
    const changes = await inStore({
      run: ({ store }) => {
        store.insertTask(FIRST_TASK);
        store.insertTask(SECOND_TASK);
        return store.listChangesSince({ cursor: 0, limit: PAGE_LIMIT });
      },
    });
    expect(changes).toEqual([
      { task: FIRST_TASK, changeNumber: 1 },
      { task: SECOND_TASK, changeNumber: 2 },
    ]);
  });

  test('replacing the first task stamps 3, moves it last and raises the last change number to 3', async () => {
    const renamed = { ...FIRST_TASK, title: 'Renamed' };
    const result = await inStore({
      run: ({ store }) => {
        store.insertTask(FIRST_TASK);
        store.insertTask(SECOND_TASK);
        store.replaceTask(renamed);
        return { last: store.lastChangeNumber(), changes: store.listChangesSince({ cursor: 0, limit: PAGE_LIMIT }) };
      },
    });
    expect(result).toEqual({
      last: 3,
      changes: [
        { task: SECOND_TASK, changeNumber: 2 },
        { task: renamed, changeNumber: 3 },
      ],
    });
  });

  test('the cursor excludes what it has seen and the limit cuts the page', async () => {
    const result = await inStore({
      run: ({ store }) => {
        [1, 2, 3].forEach((number) => store.insertTask(buildTask({ number, orderKey: `a${number}` })));
        return {
          afterOne: store.listChangesSince({ cursor: 1, limit: PAGE_LIMIT }).map(({ changeNumber }) => changeNumber),
          firstTwo: store.listChangesSince({ cursor: 0, limit: 2 }).map(({ changeNumber }) => changeNumber),
        };
      },
    });
    expect(result).toEqual({ afterOne: [2, 3], firstTwo: [1, 2] });
  });

  test('a write the rules refuse and an idempotent replay leave the last change number unchanged', async () => {
    const stub = newProjectStub();
    const lastChangeNumber = () =>
      runInDurableObject(stub, (_instance, state) => new SqliteTaskStore(state.storage.sql).lastChangeNumber());
    unwrap(
      await stub.addTasks({
        openTasksMax: PROJECT_OPEN_TASKS_MAX,
        actor: AGENT_ACTOR,
        drafts: [{ ...draftOf('Once'), idempotencyKey: 'run-1' }],
      }),
    );
    expect(await lastChangeNumber()).toBe(1);
    await stub.addTasks({ openTasksMax: PROJECT_OPEN_TASKS_MAX, actor: AGENT_ACTOR, drafts: [draftOf('  ')] });
    expect(await lastChangeNumber()).toBe(1);
    unwrap(
      await stub.addTasks({
        openTasksMax: PROJECT_OPEN_TASKS_MAX,
        actor: AGENT_ACTOR,
        drafts: [{ ...draftOf('Once'), idempotencyKey: 'run-1' }],
      }),
    );
    expect(await lastChangeNumber()).toBe(1);
  });
});
