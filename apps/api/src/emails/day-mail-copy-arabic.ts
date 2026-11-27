import type { DayMailCopy } from './day-mail-copy';
export const DAY_MAIL_COPY_ARABIC: DayMailCopy = {
  moreTasks: (count: number): string => `و${count} أخرى.`,
  overdue: ' · متأخرة',
  lineSeparator: ' · ',
  workspaceSeparator: ' / ',
};
