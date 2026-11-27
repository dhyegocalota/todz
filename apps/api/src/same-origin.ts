import { HttpHeader } from './http-header';

const SAME_ORIGIN_FETCH_SITE = 'same-origin';

// NB ADR 0051: a post is same-origin by Sec-Fetch-Site when sent, else by an Origin equal to the expected origin, else refused.
export function isSameOriginRequest({ request, origin }: { request: Request; origin: string }): boolean {
  const fetchSite = request.headers.get(HttpHeader.SecFetchSite);
  if (fetchSite !== null) return fetchSite === SAME_ORIGIN_FETCH_SITE;
  return request.headers.get(HttpHeader.Origin) === origin;
}
