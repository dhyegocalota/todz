import type { DayMailCopy } from './day-mail-copy';
export const DAY_MAIL_COPY_CHINESE: DayMailCopy = {
  moreTasks: (count: number): string => `另有 ${count} 项。`,
  overdue: ' · 已逾期',
  lineSeparator: ' · ',
  workspaceSeparator: ' / ',
};
