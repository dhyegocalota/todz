import type { ScenarioKind } from './scenario-kind';

export type ServerTiming = { directory: number; project: number };

export type Sample = { scenario: ScenarioKind; status: number; durationMs: number; serverTiming: ServerTiming | null };

const FAILED_STATUS = 0;
const DURATION_PATTERN = /(?:^|,)\s*(directory|project);dur=([0-9.]+)/g;
const DURATION_NAME_GROUP = 1;
const DURATION_VALUE_GROUP = 2;

export function serverTimingOf(header: string | null): ServerTiming | null {
  if (header === null) return null;
  const durations = Object.fromEntries(
    [...header.matchAll(DURATION_PATTERN)].map((match) => [match[DURATION_NAME_GROUP], Number(match[DURATION_VALUE_GROUP])]),
  );
  const { directory, project } = durations;
  if (directory === undefined || project === undefined) return null;
  return { directory, project };
}

export function timedFetch({
  fetch: underlyingFetch,
  now,
  scenario,
  record,
}: {
  fetch: typeof fetch;
  now: () => number;
  scenario: ScenarioKind;
  record: (sample: Sample) => void;
}): typeof fetch {
  return async (input, init) => {
    const startedAt = now();
    try {
      const response = await underlyingFetch(input, init);
      record({
        scenario,
        status: response.status,
        durationMs: now() - startedAt,
        serverTiming: serverTimingOf(response.headers.get('Server-Timing')),
      });
      return response;
    } catch (failure) {
      record({ scenario, status: FAILED_STATUS, durationMs: now() - startedAt, serverTiming: null });
      throw failure;
    }
  };
}
