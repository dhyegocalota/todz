import type { Env } from '../env';
import type { LandingNotice } from './landing-page';

enum WaitlistLimit {
  Client = 'client',
  Address = 'address',
  Global = 'global',
}

export type WaitlistRefusal = LandingNotice.TryAgain | LandingNotice.OpensSoon;

export function isWaitlistUnguarded(_input: { request: Request; env: Env }): boolean {
  throw new Error('isWaitlistUnguarded is not implemented');
}

export async function waitlistClientRefusal(_input: { request: Request; env: Env }): Promise<WaitlistRefusal | null> {
  throw new Error('waitlistClientRefusal is not implemented');
}

export async function waitlistAddressRefusal(_input: { request: Request; env: Env; address: string }): Promise<WaitlistRefusal | null> {
  throw new Error('waitlistAddressRefusal is not implemented');
}

export async function waitlistGlobalRefusal(_input: { request: Request; env: Env }): Promise<WaitlistRefusal | null> {
  throw new Error('waitlistGlobalRefusal is not implemented');
}
