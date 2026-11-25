import { HttpStatus } from '../http-status';
import { ADMIN_RESPONSE_HEADERS } from './admin-paths';

export async function serveAdminLinkPage(): Promise<Response> {
  return new Response('link page', { status: HttpStatus.Ok, headers: ADMIN_RESPONSE_HEADERS });
}
