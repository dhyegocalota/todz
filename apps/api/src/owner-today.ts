const CALENDAR_LOCALE = 'en-US';
const DATE_PART_TYPES = ['year', 'month', 'day'] as const;

type DatePartType = (typeof DATE_PART_TYPES)[number];

function datePart({ parts, type }: { parts: Intl.DateTimeFormatPart[]; type: DatePartType }): string {
  const part = parts.find((candidate) => candidate.type === type);
  if (part === undefined) throw new Error(`the ${type} of today is missing`);
  return part.value;
}

// NB ADR 0018: the MCP server's today is the calendar date in the owner's time zone.
export function calendarDateInTimeZone({ timeZone, now }: { timeZone: string; now: number }): string {
  const parts = new Intl.DateTimeFormat(CALENDAR_LOCALE, { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(
    now,
  );
  return DATE_PART_TYPES.map((type) => datePart({ parts, type })).join('-');
}
