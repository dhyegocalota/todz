import type { DayEmailCopy, DayEmailEmptyCopy } from './day-email-copy';
import { EmailSlot } from '../../src/emails/email-slot';

const SHARED_COPY = {
  replyHint: `ردّ من العنوان الذي تسجّل الدخول به، في سطر واحد، لإضافتها إلى اليوم في Inbox الخاص بـ ${EmailSlot.Workspace}.`,
  footer: `أُرسل في ${EmailSlot.Time} لأن «أرسل لي يومي بالبريد» مفعّل في إعدادات todz، حيث يبدأ مفعّلًا.`,
  stopLabel: 'أوقف هذه الرسائل',
};

export const DAY_EMAIL_COPY_ARABIC: DayEmailCopy = {
  ...SHARED_COPY,
  subject: `يومك: يستحق ${EmailSlot.Count}`,
  preview: `يستحق ${EmailSlot.Count} اليوم في todz. ردّ لإضافة مهمة.`,
  heading: `يستحق ${EmailSlot.Count} اليوم`,
};

export const DAY_EMAIL_EMPTY_COPY_ARABIC: DayEmailEmptyCopy = {
  ...SHARED_COPY,
  subject: 'يومك: لا شيء يستحق',
  preview: 'لا شيء يستحق اليوم في todz. ردّ لإضافة مهمة.',
  heading: 'لا شيء يستحق اليوم',
};
