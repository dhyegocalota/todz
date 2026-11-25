import { MINUTES_PER_HOUR, SECONDS_PER_MINUTE } from '@todz/types';
import { HttpHeader } from '../http-header';
import { HttpStatus } from '../http-status';

export const SELF_HOST_PATH = '/self-host';
// NB ADR 0059: the guide's one published copy is the docs page; the site only redirects to it.
export const DOCS_SELF_HOST_URL = 'https://docs.todz.app/self-host';
const DOCS_REDIRECT_MAX_AGE_SECONDS = SECONDS_PER_MINUTE * MINUTES_PER_HOUR;
const DOCS_REDIRECT_CACHE_CONTROL = `max-age=${DOCS_REDIRECT_MAX_AGE_SECONDS}`;

export function redirectToDocs(): Response {
  return new Response(null, {
    status: HttpStatus.MovedPermanently,
    headers: { [HttpHeader.Location]: DOCS_SELF_HOST_URL, [HttpHeader.CacheControl]: DOCS_REDIRECT_CACHE_CONTROL },
  });
}
