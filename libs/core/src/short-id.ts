import { TASK_SHORT_ID_PREFIX } from '@todz/types';

const SHORT_ID_PATTERN = new RegExp(`^${TASK_SHORT_ID_PREFIX}([1-9][0-9]{0,8})$`, 'i');
const SHORT_ID_NUMBER_GROUP = 1;

export function formatShortId(number: number): string {
  return `${TASK_SHORT_ID_PREFIX}${number}`;
}

export function parseShortId(text: string): number | null {
  const match = SHORT_ID_PATTERN.exec(text.trim());
  if (!match) return null;
  return Number(match[SHORT_ID_NUMBER_GROUP]);
}
