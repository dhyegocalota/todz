import { MILLISECONDS_PER_HOUR, MILLISECONDS_PER_MINUTE } from '@todz/types';
import type { Env } from '../env';
import { ADMIN_SIGN_IN_LINK_LIFETIME_MINUTES } from './admin-paths';

export const ADMIN_SIGN_IN_LINK_LIFETIME_MS = ADMIN_SIGN_IN_LINK_LIFETIME_MINUTES * MILLISECONDS_PER_MINUTE;
export const ADMIN_SESSION_LIFETIME_MS = 12 * MILLISECONDS_PER_HOUR;

export enum AdminCookie {
  Challenge = '__Host-todz_admin_challenge',
  Session = '__Host-todz_admin',
}

export function adminCookieHeaderOf(_cookie: { cookie: AdminCookie; value: string }): string {
  throw new Error('adminCookieHeaderOf is not implemented');
}

export function clearedAdminCookieHeaderOf(_cookie: { cookie: AdminCookie }): string {
  throw new Error('clearedAdminCookieHeaderOf is not implemented');
}

export function adminCookieValueOf(_lookup: { request: Request; cookie: AdminCookie }): string | null {
  throw new Error('adminCookieValueOf is not implemented');
}

export function isSameOriginPost(_post: { request: Request; env: Env }): boolean {
  throw new Error('isSameOriginPost is not implemented');
}

export function adminEmailOf(_env: Env): string | null {
  throw new Error('adminEmailOf is not implemented');
}

export async function hasAdminSession(_check: { request: Request; env: Env; now: number }): Promise<boolean> {
  throw new Error('hasAdminSession is not implemented');
}
