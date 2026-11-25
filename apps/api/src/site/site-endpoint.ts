import { HttpMethod } from '../http-method';
import { HttpStatus } from '../http-status';
import { noRouteResponse } from '../owner-errors';
import { LandingNotice, serveLandingPage } from './landing-page';
import { serveSelfHostPage } from './self-host-page';
import { JOIN_PATH, LANDING_PATH, SELF_HOST_PATH } from './site-shell';

const LOCATION_HEADER = 'Location';

type SiteRoute = () => Promise<Response> | Response;

function routeKey({ method, pathname }: { method: string; pathname: string }): string {
  return `${method} ${pathname}`;
}

function serveLanding(): Promise<Response> {
  return serveLandingPage({ notice: LandingNotice.None, siteKey: null });
}

function serveJoin(): Promise<Response> {
  return serveLandingPage({ notice: LandingNotice.OpensSoon, siteKey: null });
}

function redirectToLanding(): Response {
  return new Response(null, { status: HttpStatus.SeeOther, headers: { [LOCATION_HEADER]: LANDING_PATH } });
}

const ROUTE_OF_REQUEST: Record<string, SiteRoute> = {
  [routeKey({ method: HttpMethod.Get, pathname: LANDING_PATH })]: serveLanding,
  [routeKey({ method: HttpMethod.Head, pathname: LANDING_PATH })]: serveLanding,
  [routeKey({ method: HttpMethod.Get, pathname: SELF_HOST_PATH })]: serveSelfHostPage,
  [routeKey({ method: HttpMethod.Head, pathname: SELF_HOST_PATH })]: serveSelfHostPage,
  [routeKey({ method: HttpMethod.Post, pathname: JOIN_PATH })]: serveJoin,
  [routeKey({ method: HttpMethod.Get, pathname: JOIN_PATH })]: redirectToLanding,
};

export async function serveSite({ request }: { request: Request }): Promise<Response> {
  const { pathname } = new URL(request.url);
  const route = ROUTE_OF_REQUEST[routeKey({ method: request.method, pathname })];
  if (route === undefined) return noRouteResponse();
  return route();
}
