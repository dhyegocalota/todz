import { DAY_EMAIL_CATCH_UP_MINUTES, FORMATTER_LOCALE, MINUTES_PER_HOUR } from '@todz/types';
import { calendarDateInTimeZone } from '../owner-today';
import { canonicalTimeZone } from '../time-zone';

type ClockPartType = 'hour' | 'minute';

function clockPart({ parts, type }: { parts: Intl.DateTimeFormatPart[]; type: ClockPartType }): number {
  const part = parts.find((candidate) => candidate.type === type);
  if (part === undefined) throw new Error(`the ${type} of the local time is missing`);
  return Number(part.value);
}

function localMinuteOfDay({ timeZone, now }: { timeZone: string; now: number }): number {
  const parts = new Intl.DateTimeFormat(FORMATTER_LOCALE, { timeZone, hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).formatToParts(
    now,
  );
  return clockPart({ parts, type: 'hour' }) * MINUTES_PER_HOUR + clockPart({ parts, type: 'minute' });
}

// NB ADR 0063: due from the chosen local minute until the catch-up minutes pass, on the same local date, in a zone that still resolves.
export function dueDayOf({ timeZone, minutes, now }: { timeZone: string; minutes: number; now: number }): string | null {
  if (canonicalTimeZone(timeZone) === null) return null;
  const minuteOfDay = localMinuteOfDay({ timeZone, now });
  const isInWindow = minuteOfDay >= minutes && minuteOfDay < minutes + DAY_EMAIL_CATCH_UP_MINUTES;
  if (!isInWindow) return null;
  return calendarDateInTimeZone({ timeZone, now });
}
