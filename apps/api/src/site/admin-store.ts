import type { WaitlistRow, WaitlistSummary } from './admin-waitlist';

export const ADMIN_WAITLIST_ROWS_MAX = 200;

type AdminLinkInsertion = {
  database: D1Database;
  digest: string;
  email: string;
  challenge: string;
  now: number;
  expiresAt: number;
  windowStart: number;
  linksPerWindowMax: number;
};

type AdminLinkSpending = { database: D1Database; digest: string; challenge: string; email: string; now: number };

type AdminSessionOpening = { database: D1Database; digest: string; email: string; now: number; expiresAt: number };

export async function insertAdminLinkWithinLimit(_insertion: AdminLinkInsertion): Promise<boolean> {
  throw new Error('insertAdminLinkWithinLimit is not implemented');
}

export async function spendAdminLink(_spending: AdminLinkSpending): Promise<boolean> {
  throw new Error('spendAdminLink is not implemented');
}

export async function deleteAdminLink(_deletion: { database: D1Database; digest: string }): Promise<void> {
  throw new Error('deleteAdminLink is not implemented');
}

export async function openAdminSession(_opening: AdminSessionOpening): Promise<void> {
  throw new Error('openAdminSession is not implemented');
}

export async function adminSessionEmail(_lookup: { database: D1Database; digest: string; now: number }): Promise<string | null> {
  throw new Error('adminSessionEmail is not implemented');
}

export async function deleteAdminSession(_deletion: { database: D1Database; digest: string }): Promise<void> {
  throw new Error('deleteAdminSession is not implemented');
}

export async function waitlistSummaryOf(_summary: { database: D1Database; now: number }): Promise<WaitlistSummary> {
  throw new Error('waitlistSummaryOf is not implemented');
}

export async function waitlistRowsOf(_export: { database: D1Database }): Promise<WaitlistRow[]> {
  throw new Error('waitlistRowsOf is not implemented');
}
