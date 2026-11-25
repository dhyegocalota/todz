import type { ScenarioKind } from './scenario-kind';

export type ServerTiming = { directory: number; project: number };

export type Sample = { scenario: ScenarioKind; status: number; durationMs: number; serverTiming: ServerTiming | null };

export function serverTimingOf(_: string | null): ServerTiming | null {
  throw new Error('serverTimingOf is not implemented');
}

export function timedFetch(_: {
  fetch: typeof fetch;
  now: () => number;
  scenario: ScenarioKind;
  record: (sample: Sample) => void;
}): typeof fetch {
  throw new Error('timedFetch is not implemented');
}
