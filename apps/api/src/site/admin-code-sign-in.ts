import type { SiteContext } from './site-endpoint';

export async function serveAdminCodeSession(context: SiteContext): Promise<Response> {
  throw new Error(`serveAdminCodeSession is not implemented for ${context.request.url}`);
}
