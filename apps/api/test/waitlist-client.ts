import { WAITLIST_FILL_HOLD_MS } from '@todz/types';
import { env } from 'cloudflare:workers';
import { renderStampOf } from '../src/site/waitlist-stamp';
import { TURNSTILE_TEST_SECRET, recordingLimiter } from './email-sign-in-client';

export const JSON_ACCEPT = 'application/json';

const STAMP_VALUE_PATTERN = /(name="stamp" value=")[^"]*(")/g;

export function withoutStamps(html: string): string {
  return html.replace(STAMP_VALUE_PATTERN, '$1$2');
}

export enum LimiterBinding {
  Client = 'WAITLIST_LIMITER',
  Address = 'WAITLIST_ADDRESS_LIMITER',
  Global = 'WAITLIST_GLOBAL_LIMITER',
}

export type Limiters = Partial<Record<LimiterBinding, RateLimit | undefined>>;

export type RecordedLimiters = { limiters: Limiters; keys: Record<LimiterBinding, string[]> };

export type WaitlistRow = {
  address: string;
  joined_at: number;
  confirmation_claimed_at: number | null;
  confirmation_failed_at: number | null;
};

export function joinStampOf({
  secret = TURNSTILE_TEST_SECRET,
  renderedAt = Date.now() - WAITLIST_FILL_HOLD_MS,
}: { secret?: string; renderedAt?: number } = {}): Promise<string> {
  return renderStampOf({ secret, renderedAt });
}

export function recordedLimiters({ refusing = [] }: { refusing?: LimiterBinding[] } = {}): RecordedLimiters {
  const recorded = Object.values(LimiterBinding).map((binding) => ({
    binding,
    ...recordingLimiter({ isAllowed: !refusing.includes(binding) }),
  }));
  return {
    limiters: Object.fromEntries(recorded.map(({ binding, limiter }) => [binding, limiter])),
    keys: Object.fromEntries(recorded.map(({ binding, keys }) => [binding, keys])) as Record<LimiterBinding, string[]>,
  };
}

export function throwingLimiter(): RateLimit {
  return {
    async limit() {
      throw new Error('the limiter is down');
    },
  };
}

export async function seedJoins({ count, joinedAt }: { count: number; joinedAt: number }): Promise<string> {
  const prefix = `seeded-${crypto.randomUUID()}-`;
  await env.DIRECTORY.prepare(
    "WITH RECURSIVE sequence (position) AS (SELECT 1 UNION ALL SELECT position + 1 FROM sequence WHERE position < ?1) INSERT INTO waitlist (address, joined_at, confirmation_claimed_at) SELECT ?2 || position || '@example.com', ?3, ?3 FROM sequence",
  )
    .bind(count, prefix, joinedAt)
    .run();
  return prefix;
}

export async function deleteSeededJoins(prefix: string): Promise<void> {
  await env.DIRECTORY.prepare("DELETE FROM waitlist WHERE address LIKE ?1 || '%'").bind(prefix).run();
}

export async function waitlistRows(address: string): Promise<WaitlistRow[]> {
  const { results } = await env.DIRECTORY.prepare(
    'SELECT address, joined_at, confirmation_claimed_at, confirmation_failed_at FROM waitlist WHERE address = ?',
  )
    .bind(address)
    .all<WaitlistRow>();
  return results;
}
