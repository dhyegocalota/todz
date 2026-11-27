import type { DayMailCopy } from './day-mail-copy';
export const DAY_MAIL_COPY_FRENCH: DayMailCopy = {
  moreTasks: (count: number): string => `et ${count} de plus.`,
  overdue: ' · en retard',
  lineSeparator: ' · ',
  workspaceSeparator: ' / ',
};
