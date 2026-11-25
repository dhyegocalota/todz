import { FORMATTER_LOCALE } from '@todz/types';

const VERSION_PATTERN = /^\d{1,9}(\.\d{1,9}){0,2}$/;
const PART_SEPARATOR = '.';
const PART_COUNT = 3;
const ZERO_PART = '0';
const NUMERIC_COLLATOR = new Intl.Collator(FORMATTER_LOCALE, { numeric: true });

function paddedVersion(version: string): string {
  const parts = version.split(PART_SEPARATOR);
  return [...parts, ...Array.from({ length: PART_COUNT - parts.length }, () => ZERO_PART)].join(PART_SEPARATOR);
}

export function isAppVersionAccepted({ candidate, minimum }: { candidate: string | null; minimum: string }): boolean {
  if (candidate === null) return false;
  if (!VERSION_PATTERN.test(candidate)) return false;
  return NUMERIC_COLLATOR.compare(paddedVersion(candidate), paddedVersion(minimum)) >= 0;
}
