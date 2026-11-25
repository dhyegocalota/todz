import { MILLISECONDS_PER_SECOND } from '@todz/types';
import { ORIGIN_OF_TARGET, PerfTarget } from './run-plan';

export type Scheduler = (callback: () => void, delayMs: number) => void;

export const realScheduler: Scheduler = (callback, delayMs) => {
  setTimeout(callback, delayMs).unref();
};

const ALLOWED_METHOD = 'POST';
const ALLOWED_URL = `${ORIGIN_OF_TARGET[PerfTarget.Production]}/mcp`;
const INTERRUPTED_MESSAGE = 'the run was interrupted';

export function guardedFetch({
  fetch: underlyingFetch,
  deadlineMs,
  schedule,
  requestMax,
  interruption,
}: {
  fetch: typeof fetch;
  deadlineMs: number;
  schedule: Scheduler;
  requestMax: number;
  interruption: AbortSignal;
}): typeof fetch {
  const deadline = new AbortController();
  const deadlineMessage = `the ${deadlineMs / MILLISECONDS_PER_SECOND} seconds of the run are over`;
  const stopped = AbortSignal.any([deadline.signal, interruption]);
  const stopMessage = () => (interruption.aborted ? INTERRUPTED_MESSAGE : deadlineMessage);
  const expired = new Promise<never>((_, reject) => {
    stopped.addEventListener('abort', () => reject(new Error(stopMessage())), { once: true });
  });
  expired.catch(() => undefined);
  const state = { isTimerStarted: false, sentCount: 0 };
  return async (input, init) => {
    const request = new Request(input, init);
    const isAllowed = request.method === ALLOWED_METHOD && request.url === ALLOWED_URL;
    if (!isAllowed) throw new Error(`production sends only ${ALLOWED_METHOD} ${ALLOWED_URL}`);
    if (stopped.aborted) throw new Error(stopMessage());
    if (state.sentCount >= requestMax) throw new Error(`production sends at most ${requestMax} requests`);
    state.sentCount += 1;
    if (!state.isTimerStarted) {
      state.isTimerStarted = true;
      schedule(() => deadline.abort(), deadlineMs);
    }
    const signal = AbortSignal.any([request.signal, stopped]);
    return Promise.race([underlyingFetch(new Request(request, { redirect: 'error', signal })), expired]);
  };
}
