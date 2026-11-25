import type { Env } from '../env';
import { HttpMethod } from '../http-method';
import { HttpStatus } from '../http-status';
import { noRouteResponse } from '../owner-errors';
import { LandingNotice, serveLandingPage } from './landing-page';
import { serveSelfHostPage } from './self-host-page';
import { JOIN_PATH, LANDING_PATH, SELF_HOST_PATH } from './site-shell';
import { serveWaitlistJoin, waitlistSiteKeyOf } from './waitlist-join';

const LOCATION_HEADER = 'Location';

export type SiteContext = { request: Request; env: Env; executionContext: ExecutionContext };

type SiteRoute = (context: SiteContext) => Promise<Response> | Response;

function routeKey({ method, pathname }: { method: string; pathname: string }): string {
  return `${method} ${pathname}`;
}

function serveLanding({ env }: SiteContext): Promise<Response> {
  return serveLandingPage({ notice: LandingNotice.None, siteKey: waitlistSiteKeyOf(env) });
}

function redirectToLanding(): Response {
  return new Response(null, { status: HttpStatus.SeeOther, headers: { [LOCATION_HEADER]: LANDING_PATH } });
}

const ROUTE_OF_REQUEST: Record<string, SiteRoute> = {
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
