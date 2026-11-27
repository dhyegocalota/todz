import type { DayMailCopy } from './day-mail-copy';
export const DAY_MAIL_COPY_JAPANESE: DayMailCopy = {
  moreTasks: (count: number): string => `ほか${count}件。`,
  overdue: ' · 期限切れ',
  lineSeparator: ' · ',
  workspaceSeparator: ' / ',
};
