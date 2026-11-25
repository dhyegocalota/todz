import { HttpStatus } from '../http-status';
import { noRouteResponse } from '../owner-errors';
import { LandingNotice, serveLandingPage } from './landing-page';
import { serveSelfHostPage } from './self-host-page';

const LANDING_PATH = '/';
const SELF_HOST_PATH = '/self-host';
const JOIN_PATH = '/join';
const LOCATION_HEADER = 'Location';

enum RequestMethod {
  Get = 'GET',
  Head = 'HEAD',
  Post = 'POST',
}

type SiteRoute = () => Promise<Response> | Response;

function routeKey({ method, pathname }: { method: string; pathname: string }): string {
  return `${method} ${pathname}`;
}

function serveLanding(): Promise<Response> {
  return serveLandingPage({ notice: LandingNotice.None });
}

function serveJoin(): Promise<Response> {
  return serveLandingPage({ notice: LandingNotice.OpensSoon });
}

function redirectToLanding(): Response {
  return new Response(null, { status: HttpStatus.SeeOther, headers: { [LOCATION_HEADER]: LANDING_PATH } });
}

const ROUTE_OF_REQUEST: Record<string, SiteRoute> = {
  [routeKey({ method: RequestMethod.Get, pathname: LANDING_PATH })]: serveLanding,
  [routeKey({ method: RequestMethod.Head, pathname: LANDING_PATH })]: serveLanding,
  [routeKey({ method: RequestMethod.Get, pathname: SELF_HOST_PATH })]: serveSelfHostPage,
  [routeKey({ method: RequestMethod.Head, pathname: SELF_HOST_PATH })]: serveSelfHostPage,
  [routeKey({ method: RequestMethod.Post, pathname: JOIN_PATH })]: serveJoin,
  [routeKey({ method: RequestMethod.Get, pathname: JOIN_PATH })]: redirectToLanding,
};

export async function serveSite({ request }: { request: Request }): Promise<Response> {
  const { pathname } = new URL(request.url);
  const route = ROUTE_OF_REQUEST[routeKey({ method: request.method, pathname })];
  if (route === undefined) return noRouteResponse();
  return route();
}
