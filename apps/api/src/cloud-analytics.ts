import { CLOUD_ANALYTICS_TIMEOUT_MS } from '@todz/types';
import { z } from 'zod';
import type { MeasuredTotals } from './cloud-budget';
import type { CloudMonth } from './cloud-month';
import { HttpHeader } from './http-header';
import { MediaType } from './request-body';
import { utcDayOf } from './telemetry/telemetry-day';

const GRAPHQL_URL = 'https://api.cloudflare.com/client/v4/graphql';
const GROUPS_MAX = 1000;
const BEARER_SCHEME = 'Bearer';
const REASON_LENGTH_MAX = 200;
const TIMEOUT_ERROR_NAME = 'TimeoutError';

// NB ADR 0099: the shape follows developers.cloudflare.com/durable-objects/observability/graphql-analytics (viewer, accounts filtered by accountTag, the invocation and Workers and D1 datasets).
const QUERY = `query MonthToDate($accountTag: String!, $monthStartDay: Date!, $today: Date!, $monthStart: Time!, $now: Time!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      durableObjectsInvocationsAdaptiveGroups(limit: ${GROUPS_MAX}, filter: { date_geq: $monthStartDay, date_leq: $today }) { sum { requests } }
      workersInvocationsAdaptive(limit: ${GROUPS_MAX}, filter: { datetime_geq: $monthStart, datetime_leq: $now }) { sum { requests } }
      d1AnalyticsAdaptiveGroups(limit: ${GROUPS_MAX}, filter: { date_geq: $monthStartDay, date_leq: $today }) { sum { rowsWritten } }
    }
  }
}`;

const AccountSchema = z.object({
  durableObjectsInvocationsAdaptiveGroups: z.array(z.object({ sum: z.object({ requests: z.number() }) })),
  workersInvocationsAdaptive: z.array(z.object({ sum: z.object({ requests: z.number() }) })),
  d1AnalyticsAdaptiveGroups: z.array(z.object({ sum: z.object({ rowsWritten: z.number() }) })),
});

const AnswerSchema = z.object({
  data: z.object({ viewer: z.object({ accounts: z.array(AccountSchema) }) }).nullish(),
  errors: z.array(z.object({ message: z.string() })).nullish(),
});

export enum AnalyticsOutcome {
  Totals = 'totals',
  Failed = 'failed',
}

export type AnalyticsReading =
  { kind: AnalyticsOutcome.Totals; totals: MeasuredTotals } | { kind: AnalyticsOutcome.Failed; reason: string };

function failed(reason: string): AnalyticsReading {
  return { kind: AnalyticsOutcome.Failed, reason: reason.slice(0, REASON_LENGTH_MAX) };
}

function totalOf(counts: number[]): number {
  return counts.reduce((total, count) => total + count, 0);
}

function reasonOfFailure(failure: unknown): string {
  if (failure instanceof Error && failure.name === TIMEOUT_ERROR_NAME) return 'the Cloudflare analytics timed out';
  return 'the Cloudflare analytics could not be reached';
}

async function answerOf(response: Response): Promise<z.output<typeof AnswerSchema> | null> {
  const parsed = AnswerSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) return null;
  return parsed.data;
}

export async function measuredTotalsOf({
  token,
  accountTag,
  month,
  now,
}: {
  token: string;
  accountTag: string;
  month: CloudMonth;
  now: number;
}): Promise<AnalyticsReading> {
  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { [HttpHeader.Authorization]: `${BEARER_SCHEME} ${token}`, [HttpHeader.ContentType]: MediaType.Json },
    body: JSON.stringify({
      query: QUERY,
      variables: {
        accountTag,
        monthStartDay: month.monthStartDay,
        today: utcDayOf(now),
        monthStart: new Date(month.monthStart).toISOString(),
        now: new Date(now).toISOString(),
      },
    }),
    signal: AbortSignal.timeout(CLOUD_ANALYTICS_TIMEOUT_MS),
  }).catch((failure: unknown) => failure);
  if (!(response instanceof Response)) return failed(reasonOfFailure(response));
  if (!response.ok) return failed(`the Cloudflare analytics answered ${response.status}`);
  const answer = await answerOf(response);
  if (answer === null) return failed('the Cloudflare analytics answered an unexpected shape');
  const firstError = answer.errors === null || answer.errors === undefined ? undefined : answer.errors[0];
  if (firstError !== undefined) return failed(`the Cloudflare analytics answered an error: ${firstError.message}`);
  if (answer.data === null || answer.data === undefined) return failed('the Cloudflare analytics answered no data');
  const [account, ...others] = answer.data.viewer.accounts;
  if (account === undefined || others.length > 0) return failed('the Cloudflare analytics answered no single account');
  return {
    kind: AnalyticsOutcome.Totals,
    totals: {
      workerRequests: totalOf(account.workersInvocationsAdaptive.map((group) => group.sum.requests)),
      durableObjectRequests: totalOf(account.durableObjectsInvocationsAdaptiveGroups.map((group) => group.sum.requests)),
      directoryRowsWritten: totalOf(account.d1AnalyticsAdaptiveGroups.map((group) => group.sum.rowsWritten)),
    },
  };
}
