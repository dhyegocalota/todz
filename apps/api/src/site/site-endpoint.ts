import type { Env } from '../env';
import { HttpHeader } from '../http-header';
import { HttpMethod } from '../http-method';
import { HttpStatus } from '../http-status';
import { noRouteResponse } from '../owner-errors';
import { siteKeyOf } from '../turnstile-page';
import { ADMIN_ROUTES } from './admin-routes';
import { LandingNotice, serveLandingPage } from './landing-page';
import { serveSelfHostPage } from './self-host-page';
import { JOIN_PATH, LANDING_PATH, SELF_HOST_PATH } from './site-shell';
import { serveWaitlistJoin } from './waitlist-join';

export type SiteContext = { request: Request; env: Env; executionContext: ExecutionContext };

export type SiteRoute = (context: SiteContext) => Promise<Response> | Response;

function routeKey({ method, pathname }: { method: string; pathname: string }): string {
  return `${method} ${pathname}`;
}

function serveLanding({ env }: SiteContext): Promise<Response> {
  return serveLandingPage({ notice: LandingNotice.None, siteKey: siteKeyOf(env) });
}

function redirectToLanding(): Response {
  return new Response(null, { status: HttpStatus.SeeOther, headers: { [HttpHeader.Location]: LANDING_PATH } });
}

const ADMIN_ROUTE_OF_REQUEST: Record<string, SiteRoute> = Object.fromEntries(
  ADMIN_ROUTES.map(({ method, path, route }) => [routeKey({ method, pathname: path }), route]),
);

const ROUTE_OF_REQUEST: Record<string, SiteRoute> = {
  ...ADMIN_ROUTE_OF_REQUEST,
  [routeKey({ method: HttpMethod.Get, pathname: LANDING_PATH })]: serveLanding,
  [routeKey({ method: HttpMethod.Head, pathname: LANDING_PATH })]: serveLanding,
  [routeKey({ method: HttpMethod.Get, pathname: SELF_HOST_PATH })]: serveSelfHostPage,
  [routeKey({ method: HttpMethod.Head, pathname: SELF_HOST_PATH })]: serveSelfHostPage,
  [routeKey({ method: HttpMethod.Post, pathname: JOIN_PATH })]: serveWaitlistJoin,
  [routeKey({ method: HttpMethod.Get, pathname: JOIN_PATH })]: redirectToLanding,
};

export async function serveSite(context: SiteContext): Promise<Response> {
  const { pathname } = new URL(context.request.url);
  const route = ROUTE_OF_REQUEST[routeKey({ method: context.request.method, pathname })];
  if (route === undefined) return noRouteResponse();
  return route(context);
}
