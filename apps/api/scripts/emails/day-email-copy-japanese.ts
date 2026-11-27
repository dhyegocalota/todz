import type { DayEmailCopy, DayEmailEmptyCopy } from './day-email-copy';
import { EmailSlot } from '../../src/emails/email-slot';

const SHARED_COPY = {
  replyHint: `サインインに使っているアドレスから1行で返信すると、${EmailSlot.Workspace}のインボックスの今日にタスクとして追加されます。`,
  footer: `todzの設定で1日の予定をメールで受け取るがオンになっているため、${EmailSlot.Time}に送信しました（初期設定でオンです）。`,
  stopLabel: 'このメールを停止',
};

export const DAY_EMAIL_COPY_JAPANESE: DayEmailCopy = {
  ...SHARED_COPY,
  subject: `今日の予定：期限${EmailSlot.Count}件`,
  preview: `todzで今日が期限のタスクは${EmailSlot.Count}件です。返信するとタスクを追加できます。`,
  heading: `今日が期限のタスクは${EmailSlot.Count}件`,
};

export const DAY_EMAIL_EMPTY_COPY_JAPANESE: DayEmailEmptyCopy = {
  ...SHARED_COPY,
  subject: '今日の予定：期限なし',
  preview: 'todzで今日が期限のタスクはありません。返信するとタスクを追加できます。',
  heading: '今日が期限のタスクはありません',
};
