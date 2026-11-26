import { runCloudCapacity } from './cloud-capacity-run';
import { runDayEmails } from './day-email/day-email-run';
import type { Env } from './env';
import { enumValueOf } from './enum-value';
import { runMetricsNightly } from './telemetry/metrics-nightly';

// NB ADR 0063: wrangler.jsonc's triggers must name each cron: the day email every quarter hour.
export enum ScheduledCron {
  DayEmail = '*/15 * * * *',
  Metrics = '0 3 * * *',
}

type ScheduledRun = { scheduledTime: number; env: Env };

async function runNightly(run: ScheduledRun): Promise<void> {
  const outcomes = await Promise.allSettled([runMetricsNightly(run), runCloudCapacity(run)]);
  const failure = outcomes.find((outcome) => outcome.status === 'rejected');
  if (failure !== undefined) throw failure.reason;
}

const RUN_OF_CRON: Record<ScheduledCron, (run: ScheduledRun) => Promise<void>> = {
  [ScheduledCron.DayEmail]: runDayEmails,
  [ScheduledCron.Metrics]: runNightly,
};

export async function runScheduled({ controller, env }: { controller: ScheduledController; env: Env }): Promise<void> {
  const cron = enumValueOf({ enumeration: ScheduledCron, candidate: controller.cron });
  if (cron === null) throw new Error(`no scheduled run for the cron ${controller.cron}`);
  await RUN_OF_CRON[cron]({ scheduledTime: controller.scheduledTime, env });
}
