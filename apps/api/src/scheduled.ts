import { runDayEmails } from './day-email/day-email-run';
import type { Env } from './env';
import { enumValueOf } from './enum-value';
import { runWaitlistDigest } from './site/waitlist-digest';

// NB ADR 0052: the digest runs once a day at 11:00 UTC; NB ADR 0063: the day email runs on every quarter hour; wrangler.jsonc's triggers must name each cron.
export enum ScheduledCron {
  WaitlistDigest = '0 11 * * *',
  DayEmail = '*/15 * * * *',
}

type ScheduledRun = { scheduledTime: number; env: Env };

const RUN_OF_CRON: Record<ScheduledCron, (run: ScheduledRun) => Promise<void>> = {
  [ScheduledCron.WaitlistDigest]: runWaitlistDigest,
  [ScheduledCron.DayEmail]: runDayEmails,
};

export async function runScheduled({ controller, env }: { controller: ScheduledController; env: Env }): Promise<void> {
  const cron = enumValueOf({ enumeration: ScheduledCron, candidate: controller.cron });
  if (cron === null) throw new Error(`no scheduled run for the cron ${controller.cron}`);
  await RUN_OF_CRON[cron]({ scheduledTime: controller.scheduledTime, env });
}
