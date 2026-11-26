import type { z } from 'zod';
import type { Env } from './env';
import type { OwnerRoute, RouteParam } from './owner-routes';
import { parsedJson } from './parsed-json';
import type { SessionOwner } from './project-routing';
import { MediaType, OWNER_BODY_LENGTH_MAX, hasMediaType, isBoundedRequest } from './request-body';

export type PublicRoute = OwnerRoute.SignIn | OwnerRoute.ReadSignInMethod | OwnerRoute.RequestSignInLink;

export type SessionRoute = Exclude<OwnerRoute, PublicRoute>;

export type OwnerContext = {
  request: Request;
  env: Env;
  now: number;
  executionContext: ExecutionContext;
  params: Record<string, string>;
};

export type PublicHandler = (context: OwnerContext) => Promise<Response>;

export type SessionContext = OwnerContext & { owner: SessionOwner; secret: string };

export type SessionHandler = (context: SessionContext) => Promise<Response>;

export function routeParam({ context, name }: { context: OwnerContext; name: RouteParam }): string {
  const value = context.params[name];
  if (value === undefined) throw new Error(`the route has no ${name} parameter`);
  return value;
}

async function boundedJson<Schema extends z.ZodType>({
  request,
  schema,
  maxLength,
}: {
  request: Request;
  schema: Schema;
  maxLength?: number;
}): Promise<z.output<Schema> | null> {
  if (!isBoundedRequest({ request, maxLength })) return null;
  const parsed = schema.safeParse(parsedJson(await request.text()));
  if (!parsed.success) return null;
  return parsed.data;
}

export function parsedBody<Schema extends z.ZodType>({
  request,
  schema,
}: {
  request: Request;
  schema: Schema;
}): Promise<z.output<Schema> | null> {
  return boundedJson({ request, schema, maxLength: OWNER_BODY_LENGTH_MAX });
}

export async function parsedPublicBody<Schema extends z.ZodType>({
  request,
  schema,
}: {
  request: Request;
  schema: Schema;
}): Promise<z.output<Schema> | null> {
  if (!hasMediaType({ request, mediaType: MediaType.Json })) return null;
  return boundedJson({ request, schema });
}
