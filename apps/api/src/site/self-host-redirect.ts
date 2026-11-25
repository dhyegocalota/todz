import { HttpHeader } from '../http-header';
import { HttpStatus } from '../http-status';

export const SELF_HOST_PATH = '/self-host';
// NB ADR 0059: the guide's one published copy is the docs page; the site only redirects to it.
export const DOCS_SELF_HOST_URL = 'https://docs.todz.app/self-host';

export function redirectToDocs(): Response {
  return new Response(null, { status: HttpStatus.MovedPermanently, headers: { [HttpHeader.Location]: DOCS_SELF_HOST_URL } });
}
