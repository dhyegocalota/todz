import type { Env } from './env';

const LOCAL_HOSTNAMES = ['localhost', '127.0.0.1'];

export function isLocalOrigin(origin: string): boolean {
  if (!URL.canParse(origin)) return false;
  return LOCAL_HOSTNAMES.includes(new URL(origin).hostname);
}

export function isLocalHost({ env, request }: { env: Env; request: Request }): boolean {
  const { PUBLIC_ORIGIN: publicOrigin } = env;
  if (publicOrigin === undefined) return false;
  return isLocalOrigin(publicOrigin) && isLocalOrigin(request.url);
}

export function isLocalSiteHost(_input: { env: Env; request: Request }): boolean {
  throw new Error('isLocalSiteHost is not implemented');
}
