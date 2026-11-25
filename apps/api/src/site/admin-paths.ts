import { HttpHeader } from '../http-header';

export enum AdminPath {
  Panel = '/admin',
  SignInLinks = '/admin/sign-in-links',
  LinkPage = '/admin/sign-in',
  Sessions = '/admin/sessions',
  SignOut = '/admin/sign-out',
  Export = '/admin/export.csv',
}

export enum AdminField {
  Email = 'email',
  Token = 'token',
}

export const ADMIN_SIGN_IN_LINK_LIFETIME_MINUTES = 15;

export const ADMIN_RESPONSE_HEADERS: Record<string, string> = {
  [HttpHeader.CacheControl]: 'no-store',
  [HttpHeader.XRobotsTag]: 'noindex',
};
