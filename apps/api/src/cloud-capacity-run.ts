import { CLOUD_READ_REQUESTS_PER_ACCOUNT_DAY, MILLISECONDS_PER_DAY } from '@todz/types';
import { cloudAccountsMaxOf } from './cloud-accounts-max';
import { AnalyticsOutcome, measuredTotalsOf } from './cloud-analytics';
import { type BudgetUsage, BudgetLevel, budgetStatusOf, estimatedUsageOf, measuredUsageOf } from './cloud-budget';
import { BudgetSource, ESTIMATE_ONLY_NOTICE, budgetSourceOf, fallbackNoticeOf } from './cloud-budget-source';
import { isWarned, monthWritesOf, recordBudget, stampWarning } from './cloud-budget-store';
import { CLOUD_COPY } from './cloud-copy';
import { forgetCloudLevel } from './cloud-level';
import { sendCloudMail } from './cloud-mail';
import { countMailsSince, pruneMailsBefore } from './cloud-mail-meter';
import { type CloudMonth, cloudMonthOf } from './cloud-month';
import { countActiveAccounts, queueDigestThrough, stampQueueDigest } from './cloud-queue-store';
import { logNotice } from './crash-log';
import type { Env } from './env';
import { adminEmailOf } from './site/admin-session';

type CloudCapacityRun = { scheduledTime: number; env: Env };

type MonthCounts = { writes: number; emails: number; accounts: number };

type MonthUsage = { usage: BudgetUsage; source: BudgetSource; fallbackReason: string | null };

function ownerAddressOf(env: Env): string {
  const address = adminEmailOf(env);
  if (address === null) throw new Error('the cloud capacity mail needs the admin address');
  return address;
}

function estimatedMonthUsageOf({
  month,
  counts,
  fallbackReason,
}: {
  month: CloudMonth;
  counts: MonthCounts;
  fallbackReason: string | null;
}): MonthUsage {
  const readRequests = counts.accounts * CLOUD_READ_REQUESTS_PER_ACCOUNT_DAY * month.daysElapsed;
  const usage = estimatedUsageOf({ monthWrites: counts.writes, readRequests, emails: counts.emails });
  return { usage, source: BudgetSource.Estimate, fallbackReason };
}

async function monthUsageOf({
  env,
  month,
  scheduledTime,
  counts,
}: {
  env: Env;
  month: CloudMonth;
  scheduledTime: number;
  counts: MonthCounts;
}): Promise<MonthUsage> {
  const choice = budgetSourceOf(env);
  if (choice.source === BudgetSource.Estimate) {
    logNotice(ESTIMATE_ONLY_NOTICE);
    return estimatedMonthUsageOf({ month, counts, fallbackReason: null });
  }
  const reading = await measuredTotalsOf({ token: choice.token, accountTag: choice.accountTag, month, now: scheduledTime });
  if (reading.kind === AnalyticsOutcome.Failed) {
    logNotice(fallbackNoticeOf(reading.reason));
    return estimatedMonthUsageOf({ month, counts, fallbackReason: reading.reason });
  }
  const usage = measuredUsageOf({ measured: reading.totals, monthWrites: counts.writes, emails: counts.emails });
  return { usage, source: BudgetSource.Analytics, fallbackReason: null };
}

async function runBudgetGuard({ scheduledTime, env }: CloudCapacityRun): Promise<void> {
  const directory = env.DIRECTORY;
  const monthOfRun = cloudMonthOf(scheduledTime);
  const { month, monthStartDay, monthStart } = monthOfRun;
  const [writes, emails, accounts] = await Promise.all([
    monthWritesOf({ directory, monthStartDay }),
    countMailsSince({ directory, since: monthStart }),
    countActiveAccounts({ directory, now: scheduledTime }),
  ]);
  const { usage, source, fallbackReason } = await monthUsageOf({
    env,
    month: monthOfRun,
    scheduledTime,
    counts: { writes, emails, accounts },
  });
  const { level, dimension } = budgetStatusOf(usage);
  await recordBudget({ directory, month, level, heavyWrites: Math.floor(writes / Math.max(accounts, 1)), source, reason: fallbackReason });
  forgetCloudLevel();
  await pruneMailsBefore({ directory, before: monthStart - MILLISECONDS_PER_DAY });
  if (fallbackReason !== null) {
    await sendCloudMail({
      env,
      to: ownerAddressOf(env),
      subject: CLOUD_COPY.fallback.subject,
      text: CLOUD_COPY.fallback.textOf(fallbackReason),
    });
  }
  if (level === BudgetLevel.Normal) return;
  if (await isWarned({ directory, month })) return;
  await sendCloudMail({
    env,
    to: ownerAddressOf(env),
    subject: CLOUD_COPY.warning.subject,
    text: CLOUD_COPY.warning.textOf(dimension),
  });
  await stampWarning({ directory, month, now: scheduledTime });
}

async function runQueueDigest({ scheduledTime, env }: CloudCapacityRun): Promise<void> {
  const directory = env.DIRECTORY;
  const digest = await queueDigestThrough({ directory, through: scheduledTime });
  if (digest === null) return;
  await sendCloudMail({ env, to: ownerAddressOf(env), subject: CLOUD_COPY.digest.subject, text: CLOUD_COPY.digest.textOf(digest) });
  await stampQueueDigest({ directory, now: scheduledTime, through: scheduledTime });
}

export async function runCloudCapacity(run: CloudCapacityRun): Promise<void> {
  if (cloudAccountsMaxOf(run.env) === null) return;
  const outcomes = await Promise.allSettled([runBudgetGuard(run), runQueueDigest(run)]);
  const failures = outcomes.filter((outcome) => outcome.status === 'rejected');
  if (failures.length > 0) throw new Error(`the cloud capacity run failed ${failures.length} of ${outcomes.length} parts`);
}
