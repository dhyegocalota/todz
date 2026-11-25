import { env } from 'cloudflare:workers';
import { recordingLimiter } from './email-sign-in-client';

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

export async function waitlistRows(address: string): Promise<WaitlistRow[]> {
  const { results } = await env.DIRECTORY.prepare(
    'SELECT address, joined_at, confirmation_claimed_at, confirmation_failed_at FROM waitlist WHERE address = ?',
  )
    .bind(address)
    .all<WaitlistRow>();
  return results;
}
