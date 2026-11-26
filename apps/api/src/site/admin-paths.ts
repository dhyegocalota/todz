import { HttpHeader, NO_STORE } from '../http-header';

export enum AdminPath {
  Panel = '/admin',
  SignInLinks = '/admin/sign-in-links',
  LinkPage = '/admin/sign-in',
  Sessions = '/admin/sessions',
  SignOut = '/admin/sign-out',
  Metrics = '/admin/metrics',
  MetricsExport = '/admin/metrics.csv',
}

export enum AdminField {
  Email = 'email',
  Token = 'token',
}

export const ADMIN_SIGN_IN_LINK_LIFETIME_MINUTES = 15;

export const ADMIN_SESSION_LIFETIME_HOURS = 12;

export const ADMIN_RESPONSE_HEADERS: Record<string, string> = {
  [HttpHeader.CacheControl]: NO_STORE,
  [HttpHeader.XRobotsTag]: 'noindex',
};
