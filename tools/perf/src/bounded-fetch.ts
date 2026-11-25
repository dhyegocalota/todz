import type { Scheduler } from './wire-guard';

const STREAM_METHOD = 'GET';
const STREAM_PATH = '/mcp';
const TIMEOUT_MESSAGE = 'the request ran out of time';

function isStream(request: Request): boolean {
  return request.method === STREAM_METHOD && new URL(request.url).pathname === STREAM_PATH;
}

export function boundedFetch({
  fetch: underlyingFetch,
  schedule,
  requestTimeoutMs,
  deadlineMs,
}: {
  fetch: typeof fetch;
  schedule: Scheduler;
  requestTimeoutMs: number;
  deadlineMs: number;
}): typeof fetch {
  const deadline = new AbortController();
  const state = { isDeadlineStarted: false };
  return (input, init) => {
    const request = new Request(input, init);
    if (!state.isDeadlineStarted) {
      state.isDeadlineStarted = true;
      schedule(() => deadline.abort(), deadlineMs);
    }
    if (isStream(request)) return underlyingFetch(new Request(request, { signal: AbortSignal.any([request.signal, deadline.signal]) }));
    const requestTimeout = new AbortController();
    schedule(() => requestTimeout.abort(), requestTimeoutMs);
    const signal = AbortSignal.any([request.signal, deadline.signal, requestTimeout.signal]);
    const expired = new Promise<never>((_, reject) => {
      if (signal.aborted) return reject(new Error(TIMEOUT_MESSAGE));
      signal.addEventListener('abort', () => reject(new Error(TIMEOUT_MESSAGE)), { once: true });
    });
    return Promise.race([underlyingFetch(new Request(request, { signal })), expired]);
  };
}
