import { MILLISECONDS_PER_SECOND } from '@todz/types';
import { ORIGIN_OF_TARGET, PerfTarget } from './run-plan';

export type Scheduler = (callback: () => void, delayMs: number) => void;

export const realScheduler: Scheduler = (callback, delayMs) => {
  setTimeout(callback, delayMs).unref();
};

const ALLOWED_METHOD = 'POST';
const ALLOWED_URL = `${ORIGIN_OF_TARGET[PerfTarget.Production]}/mcp`;

export function guardedFetch({
  fetch: underlyingFetch,
  deadlineMs,
  schedule,
}: {
  fetch: typeof fetch;
  deadlineMs: number;
  schedule: Scheduler;
}): typeof fetch {
  const deadline = new AbortController();
  const deadlineMessage = `the ${deadlineMs / MILLISECONDS_PER_SECOND} seconds of the run are over`;
  const expired = new Promise<never>((_, reject) => {
    deadline.signal.addEventListener('abort', () => reject(new Error(deadlineMessage)), { once: true });
  });
  expired.catch(() => undefined);
  const timer = { isStarted: false };
  return async (input, init) => {
    const request = new Request(input, init);
    const isAllowed = request.method === ALLOWED_METHOD && request.url === ALLOWED_URL;
    if (!isAllowed) throw new Error(`production sends only ${ALLOWED_METHOD} ${ALLOWED_URL}`);
    if (deadline.signal.aborted) throw new Error(deadlineMessage);
    if (!timer.isStarted) {
      timer.isStarted = true;
      schedule(() => deadline.abort(), deadlineMs);
    }
    const signal = AbortSignal.any([request.signal, deadline.signal]);
    return Promise.race([underlyingFetch(new Request(request, { redirect: 'error', signal })), expired]);
  };
}
