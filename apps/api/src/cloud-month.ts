import { MILLISECONDS_PER_DAY, MILLISECONDS_PER_SECOND } from '@todz/types';
import { utcDayOf } from './telemetry/telemetry-day';

const MONTH_LENGTH = 7;

export type CloudMonth = { month: string; monthStartDay: string; monthStart: number; daysElapsed: number };

export function secondsUntilNextMonth(now: number): number {
  const { monthStart } = cloudMonthOf(now);
  const monthStartDate = new Date(monthStart);
  const nextMonthStart = Date.UTC(monthStartDate.getUTCFullYear(), monthStartDate.getUTCMonth() + 1, 1);
  return Math.ceil((nextMonthStart - now) / MILLISECONDS_PER_SECOND);
}

export function cloudMonthOf(now: number): CloudMonth {
  const month = utcDayOf(now).slice(0, MONTH_LENGTH);
  const monthStartDay = `${month}-01`;
  const monthStart = Date.parse(monthStartDay);
  return { month, monthStartDay, monthStart, daysElapsed: Math.ceil((now - monthStart) / MILLISECONDS_PER_DAY) };
}
