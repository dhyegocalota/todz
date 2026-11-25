import { HttpStatus } from '../http-status';

const HTML_CONTENT_TYPE = 'text/html; charset=utf-8';

export async function serveSelfHostPage(): Promise<Response> {
  return new Response('self-host', { status: HttpStatus.Ok, headers: { 'Content-Type': HTML_CONTENT_TYPE } });
}
