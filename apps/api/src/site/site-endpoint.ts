import { REPOSITORY } from '@todz/types';
import type { Env } from '../env';
import { HttpHeader } from '../http-header';
import { HttpMethod } from '../http-method';
import { HttpStatus } from '../http-status';
import { noRouteResponse } from '../owner-errors';
import { ADMIN_ROUTES } from './admin-routes';
import { APPCAST_PATH, serveAppcast } from './appcast';
import { discoveryResponse } from './discovery-response';
import { LANDING_MARKDOWN_FILE, MARKDOWN_MEDIA_TYPE } from './landing-markdown';
import { serveLandingPage } from './landing-page';
import { repositoryStarsOf } from './repository-stars';
import { SELF_HOST_PATH, redirectToDocs } from './self-host-redirect';
import { REPOSITORY_API_URL, REPOSITORY_STARS_CACHE_NAME } from './site-constants';
import { DISCOVERY_FILES } from './site-discovery';
import { JOIN_PATH, LANDING_PATH } from './site-shell';
import { serveWaitlistClosed } from './waitlist-closed';

export type SiteContext = { request: Request; env: Env; executionContext: ExecutionContext };

export type SiteRoute = (context: SiteContext) => Promise<Response> | Response;

function routeKey({ method, pathname }: { method: string; pathname: string }): string {
  return `${method} ${pathname}`;
}

function repositoryApiUrlOf({ REPOSITORY_API_ORIGIN: apiOrigin }: Env): string {
  if (apiOrigin === undefined) return REPOSITORY_API_URL;
  return `${apiOrigin}/repos/${REPOSITORY.path}`;
}

function serveLandingMarkdown(): Response {
  return discoveryResponse({ ...LANDING_MARKDOWN_FILE, headers: { [HttpHeader.Vary]: HttpHeader.Accept } });
}

async function serveLanding({ request, env }: SiteContext): Promise<Response> {
  const wantsMarkdown = request.headers.get(HttpHeader.Accept)?.includes(MARKDOWN_MEDIA_TYPE) === true;
  if (wantsMarkdown) return serveLandingMarkdown();
  const stars = await repositoryStarsOf({
    fetchImplementation: fetch,
    cache: await caches.open(REPOSITORY_STARS_CACHE_NAME),
    apiUrl: repositoryApiUrlOf(env),
  });
  return serveLandingPage({ stars });
}

function redirectToLanding(): Response {
  return new Response(null, { status: HttpStatus.SeeOther, headers: { [HttpHeader.Location]: LANDING_PATH } });
}

const ADMIN_ROUTE_OF_REQUEST: Record<string, SiteRoute> = Object.fromEntries(
  ADMIN_ROUTES.map(({ method, path, route }) => [routeKey({ method, pathname: path }), route]),
);

const DISCOVERY_ROUTE_OF_REQUEST: Record<string, SiteRoute> = Object.fromEntries(
  DISCOVERY_FILES.flatMap(({ path, ...file }) =>
    [HttpMethod.Get, HttpMethod.Head].map((method): [string, SiteRoute] => [
      routeKey({ method, pathname: path }),
      () => discoveryResponse(file),
    ]),
  ),
);

const ROUTE_OF_REQUEST: Record<string, SiteRoute> = {
  ...ADMIN_ROUTE_OF_REQUEST,
  ...DISCOVERY_ROUTE_OF_REQUEST,
  [routeKey({ method: HttpMethod.Get, pathname: LANDING_PATH })]: serveLanding,
  [routeKey({ method: HttpMethod.Head, pathname: LANDING_PATH })]: serveLanding,
  [routeKey({ method: HttpMethod.Get, pathname: APPCAST_PATH })]: serveAppcast,
  [routeKey({ method: HttpMethod.Head, pathname: APPCAST_PATH })]: serveAppcast,
  [routeKey({ method: HttpMethod.Get, pathname: SELF_HOST_PATH })]: redirectToDocs,
  [routeKey({ method: HttpMethod.Head, pathname: SELF_HOST_PATH })]: redirectToDocs,
  [routeKey({ method: HttpMethod.Post, pathname: JOIN_PATH })]: serveWaitlistClosed,
  [routeKey({ method: HttpMethod.Get, pathname: JOIN_PATH })]: redirectToLanding,
};

export async function serveSite(context: SiteContext): Promise<Response> {
  const { pathname } = new URL(context.request.url);
  const route = ROUTE_OF_REQUEST[routeKey({ method: context.request.method, pathname })];
  if (route === undefined) return noRouteResponse();
  return route(context);
}
