import type { Env } from './env';

export enum HostKind {
  Api = 'api',
  Site = 'site',
  WwwRedirect = 'www-redirect',
}

export function hostKindOf({ request, env }: { request: Request; env: Env }): HostKind | null {
  throw new Error(`hostKindOf is not implemented: ${request.url} ${Object.keys(env).length}`);
}
