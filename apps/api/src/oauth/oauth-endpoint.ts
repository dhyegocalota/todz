import { SIGN_IN_RATE_LIMIT_PERIOD_SECONDS } from '@todz/types';
import type { Env } from '../env';
import { HttpHeader } from '../http-header';
import { HttpMethod } from '../http-method';
import { LimitRefusal } from '../limit-refusal';
import { noRouteResponse } from '../owner-errors';
import { serveAuthorize, serveDecision } from './oauth-authorize';
import type { OAuthHandler } from './oauth-context';
import { oauthLimitResponse } from './oauth-errors';
import { OAuthLimit, oauthLimitRefusalOf } from './oauth-limiter';
import { serveOAuthLinkPage } from './oauth-link-page';
import { oauthIssuerOf } from './oauth-metadata';
import { OAuthRefusal, refusalPageOf } from './oauth-pages';
import { OAUTH_PATH_PREFIX, OAuthPath } from './oauth-paths';
import { serveRegister } from './oauth-register';
import { serveOAuthSession, serveOAuthSignInLink } from './oauth-sign-in';
import { serveRevoke, serveToken } from './oauth-token-endpoint';

enum OAuthAnswer {
  Page = 'page',
  Json = 'json',
}

type OAuthRoute = { handler: OAuthHandler; limits: OAuthLimit[]; answer: OAuthAnswer };

const PAGE_REFUSAL_OF_LIMIT_REFUSAL: Record<LimitRefusal, OAuthRefusal> = {
  [LimitRefusal.TryAgain]: OAuthRefusal.TryAgain,
  [LimitRefusal.Unavailable]: OAuthRefusal.Unavailable,
};

function pageLimitAnswerOf(refusal: LimitRefusal): Response {
  const answer = refusalPageOf(PAGE_REFUSAL_OF_LIMIT_REFUSAL[refusal]);
  if (refusal === LimitRefusal.TryAgain) answer.headers.set(HttpHeader.RetryAfter, String(SIGN_IN_RATE_LIMIT_PERIOD_SECONDS));
  return answer;
}

const LIMIT_ANSWER_OF_KIND: Record<OAuthAnswer, (refusal: LimitRefusal) => Response> = {
  [OAuthAnswer.Page]: pageLimitAnswerOf,
  [OAuthAnswer.Json]: oauthLimitResponse,
};

function routeKey({ method, pathname }: { method: string; pathname: string }): string {
  return `${method} ${pathname}`;
}

function pageRoute(handler: OAuthHandler): OAuthRoute {
  return { handler, limits: [OAuthLimit.Route], answer: OAuthAnswer.Page };
}

function jsonRoute({ handler, limits }: { handler: OAuthHandler; limits: OAuthLimit[] }): OAuthRoute {
  return { handler, limits, answer: OAuthAnswer.Json };
}

const ROUTE_OF_REQUEST: Record<string, OAuthRoute> = {
  [routeKey({ method: HttpMethod.Get, pathname: OAuthPath.Authorize })]: pageRoute(serveAuthorize),
  [routeKey({ method: HttpMethod.Post, pathname: OAuthPath.Authorize })]: pageRoute(serveDecision),
  [routeKey({ method: HttpMethod.Post, pathname: OAuthPath.SignInLinks })]: pageRoute(serveOAuthSignInLink),
  [routeKey({ method: HttpMethod.Get, pathname: OAuthPath.LinkPage })]: pageRoute(serveOAuthLinkPage),
  [routeKey({ method: HttpMethod.Post, pathname: OAuthPath.Sessions })]: jsonRoute({
    handler: serveOAuthSession,
    limits: [OAuthLimit.Route],
  }),
  [routeKey({ method: HttpMethod.Post, pathname: OAuthPath.Register })]: jsonRoute({
    handler: serveRegister,
    limits: [OAuthLimit.Route, OAuthLimit.Registration],
  }),
  [routeKey({ method: HttpMethod.Post, pathname: OAuthPath.Token })]: jsonRoute({ handler: serveToken, limits: [OAuthLimit.Route] }),
  [routeKey({ method: HttpMethod.Post, pathname: OAuthPath.Revoke })]: jsonRoute({ handler: serveRevoke, limits: [OAuthLimit.Route] }),
};

export function isOAuthPath(pathname: string): boolean {
  return pathname.startsWith(`${OAUTH_PATH_PREFIX}/`);
}

export async function serveOAuth({
  request,
  env,
  now,
  executionContext,
}: {
  request: Request;
  env: Env;
  now: number;
  executionContext: ExecutionContext;
}): Promise<Response> {
  const issuer = oauthIssuerOf(env);
  if (issuer === null) return noRouteResponse();
  const route = ROUTE_OF_REQUEST[routeKey({ method: request.method, pathname: new URL(request.url).pathname })];
  if (route === undefined) return noRouteResponse();
  const refusal = await oauthLimitRefusalOf({ request, env, limits: route.limits });
  if (refusal !== null) return LIMIT_ANSWER_OF_KIND[route.answer](refusal);
  return route.handler({ request, env, now, executionContext, issuer });
}
