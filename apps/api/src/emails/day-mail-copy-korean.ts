import type { DayMailCopy } from './day-mail-copy';
export const DAY_MAIL_COPY_KOREAN: DayMailCopy = {
  moreTasks: (count: number): string => `외 ${count}개 더.`,
  overdue: ' · 기한 지남',
  lineSeparator: ' · ',
  workspaceSeparator: ' / ',
};
