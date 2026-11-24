import type { z } from 'zod';
import type { Env } from './env';
import type { OwnerRoute, RouteParam } from './owner-routes';
import { parsedJson } from './parsed-json';
import type { SessionOwner } from './project-routing';

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

const JSON_MEDIA_TYPE = 'application/json';
const MEDIA_TYPE_PARAMETER_SEPARATOR = ';';

function isJsonRequest(request: Request): boolean {
  const contentType = request.headers.get('Content-Type');
  if (contentType === null) return false;
  const [mediaType] = contentType.split(MEDIA_TYPE_PARAMETER_SEPARATOR);
  return mediaType?.trim().toLowerCase() === JSON_MEDIA_TYPE;
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

export async function parsedPublicBody<Schema extends z.ZodType>({
  request,
  schema,
}: {
  request: Request;
  schema: Schema;
}): Promise<z.output<Schema> | null> {
  if (!isJsonRequest(request)) return null;
  return parsedBody({ request, schema });
}
