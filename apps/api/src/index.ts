import type { Env } from './env';
import { HttpStatus } from './http-status';
import { serveMcp } from './mcp-endpoint';
import { serveOwner } from './owner-endpoint';
import { SIGN_IN_CHALLENGE_PAGE_PATH, serveSignInChallengePage } from './sign-in-challenge-page';
import { SIGN_IN_PAGE_PATH, serveSignInPage } from './sign-in-page';

export { ProjectStore } from './project-store';

const MCP_PATH = '/mcp';
const OWNER_PATH = '/owner';

type Route = ({ request, env }: { request: Request; env: Env }) => Promise<Response>;

const ROUTE_OF_PATH: Record<string, Route> = {
  [MCP_PATH]: ({ request, env }) => serveMcp({ request, env, now: Date.now() }),
  [SIGN_IN_PAGE_PATH]: ({ request, env }) => serveSignInPage({ request, env }),
  [SIGN_IN_CHALLENGE_PAGE_PATH]: ({ request, env }) => serveSignInChallengePage({ request, env }),
};

function isOwnerPath(pathname: string): boolean {
  return pathname === OWNER_PATH || pathname.startsWith(`${OWNER_PATH}/`);
}

export default {
  async fetch(request, env, executionContext): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (isOwnerPath(pathname)) return serveOwner({ request, env, now: Date.now(), executionContext });
    const route = ROUTE_OF_PATH[pathname];
    if (route === undefined) return new Response(null, { status: HttpStatus.NotFound });
    return route({ request, env });
  },
} satisfies ExportedHandler<Env>;
