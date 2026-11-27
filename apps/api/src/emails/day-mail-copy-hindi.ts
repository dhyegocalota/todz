import type { DayMailCopy } from './day-mail-copy';
export const DAY_MAIL_COPY_HINDI: DayMailCopy = {
  moreTasks: (count: number): string => `और ${count} टास्क।`,
  overdue: ' · बकाया',
  lineSeparator: ' · ',
  workspaceSeparator: ' / ',
};
