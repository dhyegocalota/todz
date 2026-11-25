import type { SiteContext } from './site-endpoint';

export async function serveAdminSignInLink(_context: SiteContext): Promise<Response> {
  throw new Error('serveAdminSignInLink is not implemented');
}

export async function serveAdminSession(_context: SiteContext): Promise<Response> {
  throw new Error('serveAdminSession is not implemented');
}
