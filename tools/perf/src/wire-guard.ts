export type Scheduler = (callback: () => void, delayMs: number) => void;

export const realScheduler: Scheduler = (callback, delayMs) => {
  setTimeout(callback, delayMs).unref();
};

export function guardedFetch(_: { fetch: typeof fetch; deadlineMs: number; schedule: Scheduler }): typeof fetch {
  throw new Error('guardedFetch is not implemented');
}
