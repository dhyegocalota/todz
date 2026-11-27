import type { DayEmailCopy, DayEmailEmptyCopy } from './day-email-copy';
import { EmailSlot } from '../../src/emails/email-slot';

const SHARED_COPY = {
  replyHint: `用你登录所用的地址回复，一行即可，它就会被添加到 ${EmailSlot.Workspace} 收件箱的今天。`,
  footer: `发送于 ${EmailSlot.Time}，因为你在 todz 设置中开启了“把我的一天发到邮箱”，它默认是开启的。`,
  stopLabel: '停止接收这些邮件',
};

export const DAY_EMAIL_COPY_CHINESE: DayEmailCopy = {
  ...SHARED_COPY,
  subject: `你的一天：${EmailSlot.Count} 项到期`,
  preview: `todz 中今天有 ${EmailSlot.Count} 项到期。回复邮件即可添加任务。`,
  heading: `今天有 ${EmailSlot.Count} 项到期`,
};

export const DAY_EMAIL_EMPTY_COPY_CHINESE: DayEmailEmptyCopy = {
  ...SHARED_COPY,
  subject: '你的一天：没有到期的任务',
  preview: 'todz 中今天没有到期的任务。回复邮件即可添加任务。',
  heading: '今天没有到期的任务',
};
