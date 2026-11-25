import type { LocalRunDependencies } from './local-run';
import type { OwnerConnection } from './owner-scenario';

export type SoakResult = { updates: number; lists: number; failures: number };

export type SoakAccess = { connection: OwnerConnection; hotProjectId: string };

export function runSoak(_: { access: SoakAccess; durationMs: number; dependencies: LocalRunDependencies }): Promise<SoakResult> {
  throw new Error('runSoak is not implemented');
}
