import type { Env } from '../env';
import type { AdminPath } from './admin-paths';
import type { AdminNotice } from './admin-waitlist';

export enum AdminLimit {
  Client = 'client',
  Address = 'address',
  Global = 'global',
}

export type AdminRefusal = AdminNotice.TryAgain | AdminNotice.Closed;

export function isAdminUnguarded(_guard: { request: Request; env: Env; limits: AdminLimit[] }): boolean {
  throw new Error('isAdminUnguarded is not implemented');
}

export async function adminClientRefusal(_limit: { request: Request; env: Env; path: AdminPath }): Promise<AdminRefusal | null> {
  throw new Error('adminClientRefusal is not implemented');
}

export async function adminAddressRefusal(_limit: { request: Request; env: Env; address: string }): Promise<AdminRefusal | null> {
  throw new Error('adminAddressRefusal is not implemented');
}

export async function adminGlobalRefusal(_limit: { request: Request; env: Env }): Promise<AdminRefusal | null> {
  throw new Error('adminGlobalRefusal is not implemented');
}
