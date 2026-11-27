import type { DayMailCopy } from './day-mail-copy';
export const DAY_MAIL_COPY_SPANISH: DayMailCopy = {
  moreTasks: (count: number): string => `y ${count} más.`,
  overdue: ' · vencida',
  lineSeparator: ' · ',
  workspaceSeparator: ' / ',
};
