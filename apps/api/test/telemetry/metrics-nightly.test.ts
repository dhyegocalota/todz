import { OWNER_ACTOR, agentActor } from '@todz/core';
import { MILLISECONDS_PER_DAY, MILLISECONDS_PER_HOUR } from '@todz/types';
import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, test } from 'vitest';
import { Metric, NO_DIMENSION } from '../../src/telemetry/metric';
import { runMetricsNightly } from '../../src/telemetry/metrics-nightly';
import { METRICS_RETENTION_DAYS } from '../../src/telemetry/telemetry-constants';
import { utcDayOf, utcDayStartOf } from '../../src/telemetry/telemetry-day';
import { workerEnvWith } from '../owner-client';

const COUNTED_DAY_START = Date.UTC(2026, 10, 20);
const COUNTED_DAY = '2026-11-20';
const RUN_TIME = COUNTED_DAY_START + MILLISECONDS_PER_DAY + 3 * MILLISECONDS_PER_HOUR;
const INSIDE_THE_DAY = COUNTED_DAY_START + 5 * MILLISECONDS_PER_HOUR;
const BEFORE_THE_DAY = COUNTED_DAY_START - MILLISECONDS_PER_HOUR;
const AFTER_THE_DAY = COUNTED_DAY_START + MILLISECONDS_PER_DAY + MILLISECONDS_PER_HOUR;
const TABLES_IN_ORDER = ['metrics_daily', 'day_emails', 'owner_identities', 'projects', 'workspaces', 'owners'];

type StoredRow = { metric: string; dimension: string; count: number };

function nightlyEnv(telemetry: string | undefined) {
  return workerEnvWith({ TELEMETRY: telemetry });
}

async function countOf({ metric, dimension = NO_DIMENSION }: { metric: Metric; dimension?: string }): Promise<number | null> {
  const row = await env.DIRECTORY.prepare('SELECT count FROM metrics_daily WHERE day = ? AND metric = ? AND dimension = ?')
    .bind(COUNTED_DAY, metric, dimension)
    .first<{ count: number }>();
  if (row === null) return null;
  return row.count;
}

async function seedOwnerAt(createdAt: number): Promise<string> {
  const ownerId = crypto.randomUUID();
  await env.DIRECTORY.prepare('INSERT INTO owners (id, time_zone, created_at) VALUES (?, ?, ?)').bind(ownerId, 'UTC', createdAt).run();
  return ownerId;
}

async function seedProjectAt({ ownerId, createdAt }: { ownerId: string; createdAt: number }): Promise<string> {
  const workspaceId = crypto.randomUUID();
  const projectId = crypto.randomUUID();
  await env.DIRECTORY.batch([
    env.DIRECTORY.prepare('INSERT INTO workspaces (id, owner_id, name, created_at) VALUES (?, ?, ?, ?)').bind(
      workspaceId,
      ownerId,
      'Workspace',
      createdAt,
    ),
    env.DIRECTORY.prepare('INSERT INTO projects (id, workspace_id, name, is_inbox, created_at) VALUES (?, ?, ?, 0, ?)').bind(
      projectId,
      workspaceId,
      'Project',
      createdAt,
    ),
  ]);
  return projectId;
}

beforeEach(async () => {
  await env.DIRECTORY.batch(TABLES_IN_ORDER.map((table) => env.DIRECTORY.prepare(`DELETE FROM ${table}`)));
});

describe('the nightly aggregates', () => {
  test('owners, workspaces and projects are counted for the UTC day before the run', async () => {
    const oldOwner = await seedOwnerAt(BEFORE_THE_DAY);
    const newOwner = await seedOwnerAt(INSIDE_THE_DAY);
    await seedOwnerAt(AFTER_THE_DAY);
    await seedProjectAt({ ownerId: oldOwner, createdAt: BEFORE_THE_DAY });
    await seedProjectAt({ ownerId: newOwner, createdAt: INSIDE_THE_DAY });
    await runMetricsNightly({ scheduledTime: RUN_TIME, env: nightlyEnv('on') });
    expect(await countOf({ metric: Metric.OwnersTotal })).toBe(2);
    expect(await countOf({ metric: Metric.OwnersNew })).toBe(1);
    expect(await countOf({ metric: Metric.WorkspacesTotal })).toBe(2);
    expect(await countOf({ metric: Metric.WorkspacesNew })).toBe(1);
    expect(await countOf({ metric: Metric.ProjectsTotal })).toBe(2);
    expect(await countOf({ metric: Metric.ProjectsNew })).toBe(1);
  });

  test('day mails sent are counted from the day email claims', async () => {
    const ownerId = await seedOwnerAt(BEFORE_THE_DAY);
    await env.DIRECTORY.prepare('INSERT INTO day_emails (owner_id, day, claimed_at, sent_at) VALUES (?, ?, ?, ?)')
      .bind(ownerId, COUNTED_DAY, INSIDE_THE_DAY, INSIDE_THE_DAY)
      .run();
    await runMetricsNightly({ scheduledTime: RUN_TIME, env: nightlyEnv('on') });
    expect(await countOf({ metric: Metric.DayMailsSent })).toBe(1);
  });

  test('a second run of the same night leaves the same numbers', async () => {
    await seedOwnerAt(INSIDE_THE_DAY);
    await runMetricsNightly({ scheduledTime: RUN_TIME, env: nightlyEnv('on') });
    await runMetricsNightly({ scheduledTime: RUN_TIME, env: nightlyEnv('on') });
    expect(await countOf({ metric: Metric.OwnersNew })).toBe(1);
  });

  test('tasks added, tasks completed and agent writes by client come from the projects', async () => {
    const todayStart = utcDayStartOf(Date.now());
    const projectId = await seedProjectAt({ ownerId: await seedOwnerAt(todayStart), createdAt: todayStart });
    const project = env.PROJECT_STORE.get(env.PROJECT_STORE.idFromName(projectId));
    const draft = { title: 'Pay the rent', notes: null, dueDate: null, idempotencyKey: null };
    const added = await project.addTasks({ actor: OWNER_ACTOR, drafts: [draft, { ...draft, title: 'Call Maria' }] });
    if (!added.ok) throw new Error('the seeded tasks should be added');
    await project.addTasks({ actor: agentActor('claude-code'), drafts: [{ ...draft, title: 'Draft the report' }] });
    await project.completeTasks({ actor: OWNER_ACTOR, numbers: [added.value[0]!.task.number], note: null });
    await runMetricsNightly({ scheduledTime: todayStart + MILLISECONDS_PER_DAY + 3 * MILLISECONDS_PER_HOUR, env: nightlyEnv('on') });
    const day = utcDayOf(todayStart);
    const { results } = await env.DIRECTORY.prepare('SELECT metric, dimension, count FROM metrics_daily WHERE day = ?')
      .bind(day)
      .all<StoredRow>();
    const countOfRow = ({ metric, dimension }: { metric: Metric; dimension: string }) =>
      results.find((row) => row.metric === metric && row.dimension === dimension)?.count;
    expect(countOfRow({ metric: Metric.TasksAdded, dimension: NO_DIMENSION })).toBe(3);
    expect(countOfRow({ metric: Metric.TasksCompleted, dimension: NO_DIMENSION })).toBe(1);
    expect(countOfRow({ metric: Metric.AgentWrites, dimension: 'claude-code' })).toBe(1);
  });

  test('a self-hosted server with the variable unset writes nothing and does not fail', async () => {
    await seedOwnerAt(INSIDE_THE_DAY);
    await runMetricsNightly({ scheduledTime: RUN_TIME, env: nightlyEnv(undefined) });
    const { results } = await env.DIRECTORY.prepare('SELECT count(*) AS total FROM metrics_daily').all<{ total: number }>();
    expect(results[0]?.total).toBe(0);
  });

  test('the nightly run deletes rollups older than thirteen months', async () => {
    const expiredDay = utcDayOf(RUN_TIME - (METRICS_RETENTION_DAYS + 2) * MILLISECONDS_PER_DAY);
    await env.DIRECTORY.prepare("INSERT INTO metrics_daily (day, metric, dimension, count) VALUES (?, 'owners_total', '', 1)")
      .bind(expiredDay)
      .run();
    await runMetricsNightly({ scheduledTime: RUN_TIME, env: nightlyEnv('on') });
    const expired = await env.DIRECTORY.prepare('SELECT count(*) AS total FROM metrics_daily WHERE day = ?')
      .bind(expiredDay)
      .first<{ total: number }>();
    expect(expired?.total).toBe(0);
  });

  test('every stored row is a day, a metric name, a short dimension and a count', async () => {
    await seedOwnerAt(INSIDE_THE_DAY);
    await runMetricsNightly({ scheduledTime: RUN_TIME, env: nightlyEnv('on') });
    const { results } = await env.DIRECTORY.prepare('SELECT day, metric, dimension, count FROM metrics_daily').all<{
      day: string;
      metric: string;
      dimension: string;
      count: number;
    }>();
    expect(results.length).toBeGreaterThan(0);
    results.forEach((row) => {
      expect(row.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Object.values(Metric)).toContain(row.metric);
      expect(row.dimension).toMatch(/^[a-z0-9.|-]{0,24}$/);
      expect(Number.isInteger(row.count)).toBe(true);
    });
  });
});
