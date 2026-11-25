import type { ChangeSignals } from './change-feed';

export function openSocketSignals(_: { origin: string; token: string; projectId: string }): Promise<ChangeSignals> {
  throw new Error('openSocketSignals is not implemented');
}
