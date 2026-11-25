import type { Env } from '../env';
import { HttpHeader } from '../http-header';
import { HttpMethod } from '../http-method';
import { HttpStatus } from '../http-status';
import { noRouteResponse } from '../owner-errors';
import { siteKeyOf } from '../turnstile-page';
import { ADMIN_ROUTES } from './admin-routes';
import { discoveryResponse } from './discovery-response';
import { LandingNotice, serveLandingPage } from './landing-page';
import { SELF_HOST_PATH, redirectToDocs } from './self-host-redirect';
import { DISCOVERY_FILES } from './site-discovery';
import { JOIN_PATH, LANDING_PATH } from './site-shell';
import { serveWaitlistJoin } from './waitlist-join';

export type SiteContext = { request: Request; env: Env; executionContext: ExecutionContext };

export type SiteRoute = (context: SiteContext) => Promise<Response> | Response;

function routeKey({ method, pathname }: { method: string; pathname: string }): string {
  return `${method} ${pathname}`;
}

function serveLanding({ env }: SiteContext): Promise<Response> {
  return serveLandingPage({ notice: LandingNotice.None, siteKey: siteKeyOf(env), stampSecret: env.TURNSTILE_SECRET_KEY });
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
  [routeKey({ method: HttpMethod.Get, pathname: SELF_HOST_PATH })]: redirectToDocs,
  [routeKey({ method: HttpMethod.Head, pathname: SELF_HOST_PATH })]: redirectToDocs,
  [routeKey({ method: HttpMethod.Post, pathname: JOIN_PATH })]: serveWaitlistJoin,
  [routeKey({ method: HttpMethod.Get, pathname: JOIN_PATH })]: redirectToLanding,
};

export async function serveSite(context: SiteContext): Promise<Response> {
  const { pathname } = new URL(context.request.url);
  const route = ROUTE_OF_REQUEST[routeKey({ method: context.request.method, pathname })];
  if (route === undefined) return noRouteResponse();
  return route(context);
}
