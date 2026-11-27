import type { DayMailCopy } from './day-mail-copy';
export const DAY_MAIL_COPY_PORTUGUESE_BRAZIL: DayMailCopy = {
  moreTasks: (count: number): string => `e mais ${count}.`,
  overdue: ' · atrasada',
  lineSeparator: ' · ',
  workspaceSeparator: ' / ',
};
