import { MILLISECONDS_PER_DAY } from '@todz/types';
import type { Env } from '../env';
import { listMetricsProjects } from '../project-routing';
import { type ActivityCounts } from '../sqlite-task-store';
import { AgentClient, Metric, NO_DIMENSION, agentClientOf } from './metric';
import { type MetricWrite, pruneMetrics, replaceMetrics } from './metrics-store';
import { NIGHTLY_PROJECTS_MAX } from './telemetry-constants';
import { utcDayOf, utcDayStartOf } from './telemetry-day';
import { isTelemetryOn } from './telemetry-mode';

const DIRECTORY_COUNTS_STATEMENT = `SELECT
  (SELECT count(*) FROM owners WHERE created_at < ?2) AS owners_total,
  (SELECT count(*) FROM owners WHERE created_at >= ?1 AND created_at < ?2) AS owners_new,
  (SELECT count(*) FROM workspaces WHERE created_at < ?2) AS workspaces_total,
  (SELECT count(*) FROM workspaces WHERE created_at >= ?1 AND created_at < ?2) AS workspaces_new,
  (SELECT count(*) FROM projects WHERE created_at < ?2) AS projects_total,
  (SELECT count(*) FROM projects WHERE created_at >= ?1 AND created_at < ?2) AS projects_new,
  (SELECT count(*) FROM day_emails WHERE sent_at >= ?1 AND sent_at < ?2) AS day_mails_sent`;

type DirectoryCounts = {
  owners_total: number;
  owners_new: number;
  workspaces_total: number;
  workspaces_new: number;
  projects_total: number;
  projects_new: number;
  day_mails_sent: number;
};

type NightlyRun = { scheduledTime: number; env: Env };

type ProjectsActivity = {
  added: number;
  completed: number;
  agentWrites: { agentClient: AgentClient; count: number }[];
  failedReads: number;
};

async function directoryCountsOf({
  database,
  since,
  until,
}: {
  database: D1Database;
  since: number;
  until: number;
}): Promise<DirectoryCounts> {
  const counts = await database.prepare(DIRECTORY_COUNTS_STATEMENT).bind(since, until).first<DirectoryCounts>();
  if (counts === null) throw new Error('the directory count returned no row');
  return counts;
}

async function projectsActivityOf({ env, since, until }: { env: Env; since: number; until: number }): Promise<ProjectsActivity> {
  const projects = await listMetricsProjects({ env, limit: NIGHTLY_PROJECTS_MAX });
  const reads = await Promise.allSettled(projects.map((project) => project.countActivity({ since, until })));
  const counted = reads.flatMap((read): ActivityCounts[] => (read.status === 'fulfilled' ? [read.value] : []));
  const writes = counted.flatMap(({ agentWrites: clientWrites }) => clientWrites);
  const agentWrites = Object.values(AgentClient).map((agentClient) => ({
    agentClient,
    count: writes.filter(({ client }) => agentClientOf(client) === agentClient).reduce((total, { count }) => total + count, 0),
  }));
  return {
    added: counted.reduce((total, { added }) => total + added, 0),
    completed: counted.reduce((total, { completed }) => total + completed, 0),
    agentWrites,
    failedReads: reads.length - counted.length,
  };
}

function writesOf({ day, directory, activity }: { day: string; directory: DirectoryCounts; activity: ProjectsActivity }): MetricWrite[] {
  const plain: [Metric, number][] = [
    [Metric.OwnersTotal, directory.owners_total],
    [Metric.OwnersNew, directory.owners_new],
    [Metric.WorkspacesTotal, directory.workspaces_total],
    [Metric.WorkspacesNew, directory.workspaces_new],
    [Metric.ProjectsTotal, directory.projects_total],
    [Metric.ProjectsNew, directory.projects_new],
    [Metric.DayMailsSent, directory.day_mails_sent],
    [Metric.TasksAdded, activity.added],
    [Metric.TasksCompleted, activity.completed],
  ];
  const agentWrites = activity.agentWrites
    .filter(({ count }) => count > 0)
    .map(({ agentClient, count }) => ({ day, metric: Metric.AgentWrites, dimension: agentClient, amount: count }));
  return [...plain.map(([metric, amount]) => ({ day, metric, dimension: NO_DIMENSION, amount })), ...agentWrites];
}

export async function runMetricsNightly({ scheduledTime, env }: NightlyRun): Promise<void> {
  if (!isTelemetryOn(env)) return;
  const until = utcDayStartOf(scheduledTime);
  const since = until - MILLISECONDS_PER_DAY;
  const directory = await directoryCountsOf({ database: env.DIRECTORY, since, until });
  const activity = await projectsActivityOf({ env, since, until });
  await replaceMetrics({ database: env.DIRECTORY, writes: writesOf({ day: utcDayOf(since), directory, activity }) });
  await pruneMetrics({ database: env.DIRECTORY, now: scheduledTime });
  if (activity.failedReads > 0) throw new Error(`the metrics run could not read ${activity.failedReads} projects`);
}
