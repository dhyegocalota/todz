import type { Env } from './env';

export const WWW_PREFIX = 'www.';

export enum HostKind {
  Api = 'api',
  Site = 'site',
  WwwRedirect = 'www-redirect',
}

function hostOfOrigin(origin: string | undefined): string | null {
  if (origin === undefined) return null;
  if (!URL.canParse(origin)) return null;
  return new URL(origin).host;
}

export function hostKindOf({ request, env }: { request: Request; env: Env }): HostKind | null {
  const requestHost = new URL(request.url).host;
  const siteHost = hostOfOrigin(env.SITE_ORIGIN);
  if (requestHost === hostOfOrigin(env.PUBLIC_ORIGIN)) return HostKind.Api;
  if (siteHost === null) return null;
  if (requestHost === siteHost) return HostKind.Site;
  if (requestHost === `${WWW_PREFIX}${siteHost}`) return HostKind.WwwRedirect;
  return null;
}
