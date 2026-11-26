import { WORKSPACE_ACTIVITY_WRITE_INTERVAL_MS } from '@todz/types';

export const ACTIVITY_WRITTEN_AT_KEY = 'activity_written_at';

export function isActivityWriteDue({ writtenAt, now }: { writtenAt: number | null; now: number }): boolean {
  if (writtenAt === null) return true;
  return now - writtenAt >= WORKSPACE_ACTIVITY_WRITE_INTERVAL_MS;
}
