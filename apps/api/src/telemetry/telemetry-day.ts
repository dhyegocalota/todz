import { MILLISECONDS_PER_DAY } from '@todz/types';

const ISO_DAY_END = 10;

export function utcDayOf(milliseconds: number): string {
  return new Date(milliseconds).toISOString().slice(0, ISO_DAY_END);
}

export function utcDayStartOf(milliseconds: number): number {
  return milliseconds - (milliseconds % MILLISECONDS_PER_DAY);
}
