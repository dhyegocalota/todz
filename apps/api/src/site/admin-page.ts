import { HttpStatus } from '../http-status';
import { ADMIN_RESPONSE_HEADERS } from './admin-paths';
import type { AdminNotice, WaitlistSummary } from './admin-waitlist';

export async function serveAdminSignInPage({ notice, siteKey }: { notice: AdminNotice; siteKey: string | null }): Promise<Response> {
  return new Response(`sign-in ${notice} ${siteKey === null ? 'no-widget' : 'widget'}`, {
    status: HttpStatus.Ok,
    headers: ADMIN_RESPONSE_HEADERS,
  });
}

export async function serveAdminPanel({ summary }: { summary: WaitlistSummary }): Promise<Response> {
  return new Response(`panel ${summary.total}`, { status: HttpStatus.Ok, headers: ADMIN_RESPONSE_HEADERS });
}
