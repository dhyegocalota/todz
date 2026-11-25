import type { Env } from './env';
import { HEALTH_PATH, serveHealth } from './health';
import { HostKind, WWW_PREFIX, hostKindOf } from './host-kind';
import { HttpStatus } from './http-status';
import { serveMcp } from './mcp-endpoint';
import { serveServerCard } from './mcp-server-card';
import { serveOwner } from './owner-endpoint';
import { noRouteResponse } from './owner-errors';
import { withSecurityHeaders } from './security-headers';
import { serveTimed } from './server-timing';
import { SIGN_IN_CHALLENGE_PAGE_PATH, serveSignInChallengePage } from './sign-in-challenge-page';
import { SIGN_IN_PAGE_PATH, serveSignInPage } from './sign-in-page';
import { SELF_HOST_PATH, redirectToDocs } from './site/self-host-redirect';
import { serveSite } from './site/site-endpoint';
import { SERVER_CARD_PATH } from './site/site-urls';
import { runScheduled } from './site/waitlist-digest';

export { ProjectStore } from './project-store';

const MCP_PATH = '/mcp';
const OWNER_PATH = '/owner';

type Route = ({ request, env }: { request: Request; env: Env }) => Promise<Response>;
type HostContext = { request: Request; env: Env; executionContext: ExecutionContext };
type HostHandler = (context: HostContext) => Promise<Response>;

const ROUTE_OF_PATH: Record<string, Route> = {
  [MCP_PATH]: ({ request, env }) => serveTimed({ env, serve: (observedEnv) => serveMcp({ request, env: observedEnv, now: Date.now() }) }),
  [SERVER_CARD_PATH]: async ({ request }) => serveServerCard({ request }),
  [SIGN_IN_PAGE_PATH]: ({ request, env }) => serveSignInPage({ request, env }),
  [SIGN_IN_CHALLENGE_PAGE_PATH]: ({ request, env }) => serveSignInChallengePage({ request, env }),
};

function isOwnerPath(pathname: string): boolean {
  return pathname === OWNER_PATH || pathname.startsWith(`${OWNER_PATH}/`);
}

async function serveApi({ request, env, executionContext }: HostContext): Promise<Response> {
  const { pathname } = new URL(request.url);
  if (isOwnerPath(pathname)) {
    return serveTimed({ env, serve: (observedEnv) => serveOwner({ request, env: observedEnv, now: Date.now(), executionContext }) });
  }
  const route = ROUTE_OF_PATH[pathname];
  if (route === undefined) return noRouteResponse();
  return route({ request, env });
}

async function redirectToSite({ request }: { request: Request }): Promise<Response> {
  const siteUrl = new URL(request.url);
  if (siteUrl.pathname === SELF_HOST_PATH) return redirectToDocs();
  siteUrl.hostname = siteUrl.hostname.slice(WWW_PREFIX.length);
  return Response.redirect(siteUrl, HttpStatus.MovedPermanently);
}

const HANDLER_OF_HOST_KIND: Record<HostKind, HostHandler> = {
  [HostKind.Api]: serveApi,
  [HostKind.Site]: serveSite,
  [HostKind.WwwRedirect]: redirectToSite,
};

async function serveHost({ request, env, executionContext }: HostContext): Promise<Response> {
  if (new URL(request.url).pathname === HEALTH_PATH) return serveHealth({ request, env });
  const hostKind = hostKindOf({ request, env });
  if (hostKind === null) return noRouteResponse();
  return HANDLER_OF_HOST_KIND[hostKind]({ request, env, executionContext });
}

export default {
  async fetch(request, env, executionContext): Promise<Response> {
    return withSecurityHeaders(await serveHost({ request, env, executionContext }));
  },
  async scheduled(controller, env): Promise<void> {
    await runScheduled({ controller, env });
  },
} satisfies ExportedHandler<Env>;
