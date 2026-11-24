import type { Env } from './env';
import { serveMcp } from './mcp-endpoint';

export { ProjectStore } from './project-store';

const NOT_FOUND_STATUS = 404;
const MCP_PATH = '/mcp';

type Route = ({ request, env }: { request: Request; env: Env }) => Promise<Response>;

const ROUTE_OF_PATH: Record<string, Route> = {
  [MCP_PATH]: ({ request, env }) => serveMcp({ request, env, now: Date.now() }),
};

export default {
  async fetch(request, env): Promise<Response> {
    const route = ROUTE_OF_PATH[new URL(request.url).pathname];
    if (route === undefined) return new Response(null, { status: NOT_FOUND_STATUS });
    return route({ request, env });
  },
} satisfies ExportedHandler<Env>;
