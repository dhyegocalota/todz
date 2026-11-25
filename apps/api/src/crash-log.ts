const CRASH_EVENT = 'worker_crash';

type CrashEvent = { event: string; name?: string; message?: string };

function crashEventOf(error: unknown): CrashEvent {
  if (!(error instanceof Error)) return { event: CRASH_EVENT };
  return { event: CRASH_EVENT, name: error.name, message: error.message };
}

export function logCrash(error: unknown): void {
  console.error(JSON.stringify(crashEventOf(error)));
}
