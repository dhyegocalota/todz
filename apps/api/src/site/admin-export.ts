import type { WaitlistRow } from './admin-waitlist';
import type { SiteContext } from './site-endpoint';

export function waitlistCsvOf(_rows: WaitlistRow[]): string {
  throw new Error('waitlistCsvOf is not implemented');
}

export async function serveAdminExport(_context: SiteContext): Promise<Response> {
  throw new Error('serveAdminExport is not implemented');
}
