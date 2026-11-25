import { env } from 'cloudflare:workers';

export type WaitlistRow = {
  address: string;
  joined_at: number;
  confirmation_claimed_at: number | null;
  confirmation_failed_at: number | null;
};

export async function waitlistRows(address: string): Promise<WaitlistRow[]> {
  const { results } = await env.DIRECTORY.prepare(
    'SELECT address, joined_at, confirmation_claimed_at, confirmation_failed_at FROM waitlist WHERE address = ?',
  )
    .bind(address)
    .all<WaitlistRow>();
  return results;
}
