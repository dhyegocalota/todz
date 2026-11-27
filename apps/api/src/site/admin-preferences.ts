import { HttpMethod } from '../http-method';
import { type PagePreferences, privatePagePreferencesOf } from '../page-preferences';
import { AdminPath } from './admin-paths';

const RETURNABLE_PATHS = new Set<string>([AdminPath.Panel, AdminPath.LinkPage, AdminPath.Metrics, AdminPath.Usage, AdminPath.CloudQueue]);
const QUERY_METHODS = new Set<string>([HttpMethod.Get, HttpMethod.Head]);

export function adminPreferencesOf({ request }: { request: Request }): PagePreferences {
  const preferences = privatePagePreferencesOf({ request });
  const isReturnablePage = RETURNABLE_PATHS.has(new URL(request.url).pathname) && QUERY_METHODS.has(request.method);
  if (isReturnablePage) return preferences;
  return { ...preferences, returnPath: AdminPath.Panel };
}
