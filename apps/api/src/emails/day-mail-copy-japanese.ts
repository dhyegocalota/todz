import type { DayMailCopy } from './day-mail-copy';
export const DAY_MAIL_COPY_JAPANESE: DayMailCopy = {
  moreTasks: (count: number): string => `and ${count} more.`,
  overdue: ' · overdue',
  lineSeparator: ' · ',
  workspaceSeparator: ' / ',
};
