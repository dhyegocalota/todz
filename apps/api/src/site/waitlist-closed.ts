import { HttpHeader, NO_SNIFF, NO_STORE } from '../http-header';
import { HttpStatus } from '../http-status';
import { DOWNLOAD_PATH, SITE_URL } from './site-urls';

const WAITLIST_CLOSED_TEXT = `The waitlist is closed: todz is out. Download it at ${SITE_URL}${DOWNLOAD_PATH}\n`;
const TEXT_CONTENT_TYPE = 'text/plain; charset=utf-8';

export function serveWaitlistClosed(): Response {
  return new Response(WAITLIST_CLOSED_TEXT, {
    status: HttpStatus.Gone,
    headers: {
      [HttpHeader.ContentType]: TEXT_CONTENT_TYPE,
      [HttpHeader.CacheControl]: NO_STORE,
      [HttpHeader.ContentTypeOptions]: NO_SNIFF,
    },
  });
}
