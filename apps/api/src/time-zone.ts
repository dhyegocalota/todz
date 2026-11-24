const TIME_ZONE_MAX_LENGTH = 64;
const TIME_ZONE_LOCALE = 'en-US';
const NAMED_ZONE_PATTERN = /^[A-Za-z]/;

export function canonicalTimeZone(raw: string): string | null {
  if (raw.length > TIME_ZONE_MAX_LENGTH) return null;
  try {
    const { timeZone } = new Intl.DateTimeFormat(TIME_ZONE_LOCALE, { timeZone: raw }).resolvedOptions();
    if (!NAMED_ZONE_PATTERN.test(timeZone)) return null;
    return timeZone;
  } catch {
    return null;
  }
}
