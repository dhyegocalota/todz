import type { Env } from './env';
import { serveMcp } from './mcp-endpoint';
import { serveOwner } from './owner-endpoint';

export { ProjectStore } from './project-store';

const NOT_FOUND_STATUS = 404;
const MCP_PATH = '/mcp';
const OWNER_PATH = '/owner';

type Route = ({ request, env }: { request: Request; env: Env }) => Promise<Response>;

const ROUTE_OF_PATH: Record<string, Route> = {
  [MCP_PATH]: ({ request, env }) => serveMcp({ request, env, now: Date.now() }),
};

function isOwnerPath(pathname: string): boolean {
  return pathname === OWNER_PATH || pathname.startsWith(`${OWNER_PATH}/`);
}

export default {
  async fetch(request, env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (isOwnerPath(pathname)) return serveOwner({ request, env, now: Date.now() });
    const route = ROUTE_OF_PATH[pathname];
    if (route === undefined) return new Response(null, { status: NOT_FOUND_STATUS });
    return route({ request, env });
  },
} satisfies ExportedHandler<Env>;
