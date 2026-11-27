import type { DayMailCopy } from './day-mail-copy';
export const DAY_MAIL_COPY_GERMAN: DayMailCopy = {
  moreTasks: (count: number): string => `und ${count} weitere.`,
  overdue: ' · überfällig',
  lineSeparator: ' · ',
  workspaceSeparator: ' / ',
};
