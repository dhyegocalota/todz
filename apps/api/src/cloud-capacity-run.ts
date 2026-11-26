import { CLOUD_READ_REQUESTS_PER_ACCOUNT_DAY } from '@todz/types';
import { cloudAccountsMaxOf } from './cloud-accounts-max';
import { BudgetLevel, budgetStatusOf } from './cloud-budget';
import { claimWarning, monthTotalsOf, recordBudget } from './cloud-budget-store';
import { CLOUD_COPY } from './cloud-copy';
import { sendCloudMail } from './cloud-mail';
import { cloudMonthOf } from './cloud-month';
import { countActiveAccounts, takeQueueDigest } from './cloud-queue-store';
import type { Env } from './env';
import { adminEmailOf } from './site/admin-session';

type CloudCapacityRun = { scheduledTime: number; env: Env };

function ownerAddressOf(env: Env): string {
  const address = adminEmailOf(env);
  if (address === null) throw new Error('the cloud capacity mail needs the admin address');
  return address;
}

async function runBudgetGuard({ scheduledTime, env }: CloudCapacityRun): Promise<void> {
  const directory = env.DIRECTORY;
  const { month, monthStartDay, monthStart, daysElapsed } = cloudMonthOf(scheduledTime);
  const [totals, accounts] = await Promise.all([
    monthTotalsOf({ directory, monthStartDay, monthStart }),
    countActiveAccounts({ directory, now: scheduledTime }),
  ]);
  const readRequests = accounts * CLOUD_READ_REQUESTS_PER_ACCOUNT_DAY * daysElapsed;
  const { level, dimension } = budgetStatusOf({ monthWrites: totals.writes, readRequests, emails: totals.emails });
  const heavyWrites = Math.floor(totals.writes / Math.max(accounts, 1));
  await recordBudget({ directory, month, level, heavyWrites });
  if (level === BudgetLevel.Normal) return;
  const isFirstWarning = await claimWarning({ directory, month, now: scheduledTime });
  if (!isFirstWarning) return;
  await sendCloudMail({
    env,
    to: ownerAddressOf(env),
    subject: CLOUD_COPY.warning.subject,
    text: CLOUD_COPY.warning.textOf(dimension),
  });
}

async function runQueueDigest({ scheduledTime, env }: CloudCapacityRun): Promise<void> {
  const digest = await takeQueueDigest({ directory: env.DIRECTORY, now: scheduledTime });
  if (digest === null) return;
  await sendCloudMail({ env, to: ownerAddressOf(env), subject: CLOUD_COPY.digest.subject, text: CLOUD_COPY.digest.textOf(digest) });
}

export async function runCloudCapacity(run: CloudCapacityRun): Promise<void> {
  if (cloudAccountsMaxOf(run.env) === null) return;
  const outcomes = await Promise.allSettled([runBudgetGuard(run), runQueueDigest(run)]);
  const failures = outcomes.filter((outcome) => outcome.status === 'rejected');
  if (failures.length > 0) throw new Error(`the cloud capacity run failed ${failures.length} of ${outcomes.length} parts`);
}
