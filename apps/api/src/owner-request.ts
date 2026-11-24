import type { z } from 'zod';
import type { Env } from './env';
import type { OwnerRoute, RouteParam } from './owner-routes';
import { parsedJson } from './parsed-json';
import type { SessionOwner } from './project-routing';

export type PublicRoute = OwnerRoute.SignIn;

export type SessionRoute = Exclude<OwnerRoute, PublicRoute>;

export type OwnerContext = { request: Request; env: Env; now: number; params: Record<string, string> };

export type SessionContext = OwnerContext & { owner: SessionOwner; secret: string };

export type SessionHandler = (context: SessionContext) => Promise<Response>;

export function routeParam({ context, name }: { context: OwnerContext; name: RouteParam }): string {
  const value = context.params[name];
  if (value === undefined) throw new Error(`the route has no ${name} parameter`);
  return value;
}

export async function parsedBody<Schema extends z.ZodType>({
  request,
  schema,
}: {
  request: Request;
  schema: Schema;
}): Promise<z.output<Schema> | null> {
  const parsed = schema.safeParse(parsedJson(await request.text()));
  if (!parsed.success) return null;
  return parsed.data;
}
