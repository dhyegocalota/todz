import { runDayEmails } from './day-email/day-email-run';
import type { Env } from './env';
import { enumValueOf } from './enum-value';

// NB ADR 0063: wrangler.jsonc's triggers must name each cron: the day email every quarter hour.
export enum ScheduledCron {
  DayEmail = '*/15 * * * *',
}

type ScheduledRun = { scheduledTime: number; env: Env };

const RUN_OF_CRON: Record<ScheduledCron, (run: ScheduledRun) => Promise<void>> = {
  [ScheduledCron.DayEmail]: runDayEmails,
};

export async function runScheduled({ controller, env }: { controller: ScheduledController; env: Env }): Promise<void> {
  const cron = enumValueOf({ enumeration: ScheduledCron, candidate: controller.cron });
  if (cron === null) throw new Error(`no scheduled run for the cron ${controller.cron}`);
  await RUN_OF_CRON[cron]({ scheduledTime: controller.scheduledTime, env });
}
