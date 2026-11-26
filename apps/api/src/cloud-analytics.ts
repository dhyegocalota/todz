import { z } from 'zod';
import type { MeasuredTotals } from './cloud-budget';
import type { CloudMonth } from './cloud-month';
import { HttpHeader } from './http-header';
import { MediaType } from './request-body';
import { utcDayOf } from './telemetry/telemetry-day';

const GRAPHQL_URL = 'https://api.cloudflare.com/client/v4/graphql';
const GROUPS_MAX = 1000;
const BEARER_SCHEME = 'Bearer';

const QUERY = `query MonthToDate($monthStartDay: Date!, $today: Date!, $monthStart: Time!, $now: Time!) {
  viewer {
    accounts {
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
  data: z.object({ viewer: z.object({ accounts: z.array(AccountSchema) }) }),
  errors: z.array(z.object({ message: z.string() })).nullish(),
});

function totalOf(counts: number[]): number {
  return counts.reduce((total, count) => total + count, 0);
}

export async function measuredTotalsOf({ token, month, now }: { token: string; month: CloudMonth; now: number }): Promise<MeasuredTotals> {
  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { [HttpHeader.Authorization]: `${BEARER_SCHEME} ${token}`, [HttpHeader.ContentType]: MediaType.Json },
    body: JSON.stringify({
      query: QUERY,
      variables: {
        monthStartDay: month.monthStartDay,
        today: utcDayOf(now),
        monthStart: new Date(month.monthStart).toISOString(),
        now: new Date(now).toISOString(),
      },
    }),
  });
  if (!response.ok) throw new Error(`the Cloudflare analytics answered ${response.status}`);
  const answer = AnswerSchema.parse(await response.json());
  const hasErrors = answer.errors !== null && answer.errors !== undefined && answer.errors.length > 0;
  if (hasErrors) throw new Error('the Cloudflare analytics answered with errors');
  const [account, ...others] = answer.data.viewer.accounts;
  if (account === undefined || others.length > 0) throw new Error('the analytics token must reach exactly one account');
  return {
    workerRequests: totalOf(account.workersInvocationsAdaptive.map((group) => group.sum.requests)),
    durableObjectRequests: totalOf(account.durableObjectsInvocationsAdaptiveGroups.map((group) => group.sum.requests)),
    directoryRowsWritten: totalOf(account.d1AnalyticsAdaptiveGroups.map((group) => group.sum.rowsWritten)),
  };
}
