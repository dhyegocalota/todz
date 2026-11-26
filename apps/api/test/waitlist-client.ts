import { env } from 'cloudflare:workers';

export type WaitlistRow = {
  address: string;
  joined_at: number;
  confirmation_claimed_at: number | null;
  confirmation_failed_at: number | null;
};

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
