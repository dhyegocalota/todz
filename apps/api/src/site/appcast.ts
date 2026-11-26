import type { SiteContext } from './site-endpoint';

export const APPCAST_PATH = '/download/appcast.xml';

export async function serveAppcast(context: SiteContext): Promise<Response> {
  throw new Error('serveAppcast is not implemented');
}
