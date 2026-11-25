import { runInDurableObject } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import type { Env } from '../src/env';
import type { ProjectStore } from '../src/project-store';
import { SqliteTaskStore } from '../src/sqlite-task-store';
import { CLOCK_NOW } from './task-fixtures';

export type WorkCounts = { roundTrips: number; statements: number; projectCalls: number };

const ROUND_TRIP_STATEMENT_METHODS = new Set<PropertyKey>(['first', 'all', 'run', 'raw']);
const SEEDED_TASK_COUNT = 5_000;
const OPEN_TASK_INTERVAL = 50;
const SEEDED_WORKSPACE_COUNT = 20;
const SEEDED_PROJECTS_PER_WORKSPACE = 10;
const preparedStatements = new WeakMap<object, D1PreparedStatement>();

function countedStatement({ statement, counts }: { statement: D1PreparedStatement; counts: WorkCounts }): D1PreparedStatement {
  const counted = new Proxy(statement, {
    get(target, property) {
      const member = Reflect.get(target, property);
      if (typeof member !== 'function') return member;
      if (property === 'bind') return (...values: unknown[]) => countedStatement({ statement: target.bind(...values), counts });
      if (!ROUND_TRIP_STATEMENT_METHODS.has(property)) return member.bind(target);
      return (...parameters: unknown[]) => {
        counts.roundTrips += 1;
        return Reflect.apply(member, target, parameters);
      };
    },
  });
  preparedStatements.set(counted, statement);
  return counted;
}

function preparedStatementOf(statement: D1PreparedStatement): D1PreparedStatement {
  const prepared = preparedStatements.get(statement);
  if (prepared === undefined) throw new Error('the statement was not prepared through the counted directory');
  return prepared;
}

function countedDirectory({ directory, counts }: { directory: D1Database; counts: WorkCounts }): D1Database {
  return new Proxy(directory, {
    get(target, property) {
      const member = Reflect.get(target, property);
      if (typeof member !== 'function') return member;
      if (property === 'prepare') {
        return (query: string) => {
          counts.statements += 1;
          return countedStatement({ statement: target.prepare(query), counts });
        };
      }
      if (property === 'batch') {
        return (statements: D1PreparedStatement[]) => {
          counts.roundTrips += 1;
          return target.batch(statements.map(preparedStatementOf));
        };
      }
      return member.bind(target);
    },
  });
}

function countedStub({ stub, counts }: { stub: DurableObjectStub<ProjectStore>; counts: WorkCounts }): DurableObjectStub<ProjectStore> {
  return new Proxy(stub, {
    get(target, property) {
      const member = Reflect.get(target, property);
      if (typeof member !== 'function' || typeof property === 'symbol' || property === 'then') return member;
      return (...parameters: unknown[]) => {
        counts.projectCalls += 1;
        return Reflect.apply(member, target, parameters);
      };
    },
  });
}

function countedNamespace({
  namespace,
  counts,
}: {
  namespace: DurableObjectNamespace<ProjectStore>;
  counts: WorkCounts;
}): DurableObjectNamespace<ProjectStore> {
  return new Proxy(namespace, {
    get(target, property) {
      const member = Reflect.get(target, property);
      if (typeof member !== 'function') return member;
      if (property === 'get') return (id: DurableObjectId) => countedStub({ stub: target.get(id), counts });
      return member.bind(target);
    },
  });
}

export function countedWorkEnv(): { countedEnv: Env; counts: WorkCounts } {
  const counts: WorkCounts = { roundTrips: 0, statements: 0, projectCalls: 0 };
  const countedEnv: Env = {
    ...env,
    DIRECTORY: countedDirectory({ directory: env.DIRECTORY, counts }),
    PROJECT_STORE: countedNamespace({ namespace: env.PROJECT_STORE, counts }),
  };
  return { countedEnv, counts };
}

function rowsReadCounter(sql: SqlStorage): { countedSql: SqlStorage; rowsRead: () => number } {
  const cursors: SqlStorageCursor<Record<string, SqlStorageValue>>[] = [];
  const countedSql = new Proxy(sql, {
    get(target, property) {
      const member = Reflect.get(target, property);
      if (property !== 'exec') return member;
      return (query: string, ...bindings: unknown[]) => {
        const cursor = target.exec(query, ...bindings);
        cursors.push(cursor);
        return cursor;
      };
    },
  });
  return { countedSql, rowsRead: () => cursors.reduce((total, cursor) => total + cursor.rowsRead, 0) };
}

export function rowsReadBy({
  stub,
  use,
}: {
  stub: DurableObjectStub<ProjectStore>;
  use: (instance: ProjectStore) => unknown;
}): Promise<number> {
  return runInDurableObject(stub, async (instance, state) => {
    const { countedSql, rowsRead } = rowsReadCounter(state.storage.sql);
    const uncountedStore = Reflect.get(instance, 'store');
    Reflect.set(instance, 'store', new SqliteTaskStore(countedSql));
    try {
      await use(instance);
    } finally {
      Reflect.set(instance, 'store', uncountedStore);
    }
    return rowsRead();
  });
}

export async function seedProjectsOf({ ownerId }: { ownerId: string }): Promise<void> {
  const workspaceIds = Array.from({ length: SEEDED_WORKSPACE_COUNT }, () => crypto.randomUUID());
  const workspaceStatements = workspaceIds.map((workspaceId) =>
    env.DIRECTORY.prepare('INSERT INTO workspaces (id, owner_id, name, created_at) VALUES (?, ?, ?, ?)').bind(
      workspaceId,
      ownerId,
      'Workspace',
      CLOCK_NOW,
    ),
  );
  const projectStatements = workspaceIds.flatMap((workspaceId) =>
    Array.from({ length: SEEDED_PROJECTS_PER_WORKSPACE }, (_unused, index) =>
      env.DIRECTORY.prepare('INSERT INTO projects (id, workspace_id, name, is_inbox, created_at) VALUES (?, ?, ?, ?, ?)').bind(
        crypto.randomUUID(),
        workspaceId,
        `Project ${index}`,
        index === 0 ? 1 : 0,
        CLOCK_NOW,
      ),
    ),
  );
  await env.DIRECTORY.batch([...workspaceStatements, ...projectStatements]);
}

export function seedLargeProject(stub: DurableObjectStub<ProjectStore>): Promise<void> {
  return runInDurableObject(stub, (_instance, state) => {
    const { sql } = state.storage;
    state.storage.transactionSync(() => {
      sql.exec(
        `WITH RECURSIVE sequence(number) AS (SELECT 1 UNION ALL SELECT number + 1 FROM sequence WHERE number < ?)
         INSERT INTO tasks (number, title, state, order_key, created_by_kind, created_at, updated_at, completed_at, change_number)
         SELECT number, 'Task ' || number, CASE WHEN number % ? = 0 THEN 'open' ELSE 'done' END, 'a0' || printf('%05d', number) || 'V', 'owner', number, number,
           CASE WHEN number % ? = 0 THEN NULL ELSE number END, number FROM sequence`,
        SEEDED_TASK_COUNT,
        OPEN_TASK_INTERVAL,
        OPEN_TASK_INTERVAL,
      );
      sql.exec(
        `INSERT INTO task_history (task_number, at, actor_kind, action, fields) SELECT number, number, 'owner', 'created', '[]' FROM tasks`,
      );
      sql.exec(
        `INSERT INTO task_history (task_number, at, actor_kind, action, fields)
         SELECT number, number, 'owner', CASE WHEN state = 'open' THEN 'updated' ELSE 'completed' END, '[]' FROM tasks`,
      );
      sql.exec('DELETE FROM task_counter');
      sql.exec('INSERT INTO task_counter (last_issued_number) VALUES (?)', SEEDED_TASK_COUNT);
      sql.exec('DELETE FROM change_counter');
      sql.exec('INSERT INTO change_counter (last_change_number) VALUES (?)', SEEDED_TASK_COUNT);
    });
  });
}
