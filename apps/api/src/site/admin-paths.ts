import { HttpHeader, NO_STORE, NO_STORE_NO_TRANSFORM } from '../http-header';

export enum AdminPath {
  Panel = '/admin',
  SignInLinks = '/admin/sign-in-links',
  LinkPage = '/admin/sign-in',
  Sessions = '/admin/sessions',
  CodeSessions = '/admin/code-sessions',
  SignOut = '/admin/sign-out',
  Metrics = '/admin/metrics',
  MetricsExport = '/admin/metrics.csv',
  Usage = '/admin/usage',
  Suspensions = '/admin/suspensions',
  StoredTextResets = '/admin/stored-text-resets',
  CloudQueue = '/admin/cloud-queue',
  CloudAdmissions = '/admin/cloud-queue/admissions',
}

export enum AdminField {
  Email = 'email',
  Token = 'token',
  EmailCode = 'email_code',
  Owner = 'owner',
  Choice = 'choice',
  Count = 'count',
}

export const ADMIN_NOTICE_PARAMETER = 'notice';

export enum CloudQueueAdminNotice {
  NoRoom = 'no-room',
}

export const ADMIN_SIGN_IN_LINK_LIFETIME_MINUTES = 15;

export const ADMIN_SESSION_LIFETIME_HOURS = 12;

export const ADMIN_RESPONSE_HEADERS: Record<string, string> = {
  [HttpHeader.CacheControl]: NO_STORE,
  [HttpHeader.XRobotsTag]: 'noindex',
};

export const ADMIN_PAGE_RESPONSE_HEADERS: Record<string, string> = {
  ...ADMIN_RESPONSE_HEADERS,
  [HttpHeader.CacheControl]: NO_STORE_NO_TRANSFORM,
};
