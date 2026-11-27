import type { DayEmailCopy, DayEmailEmptyCopy } from './day-email-copy';
import { EmailSlot } from '../../src/emails/email-slot';

const SHARED_COPY = {
  replyHint: `साइन इन वाले पते से एक पंक्ति में जवाब दें, ताकि वह ${EmailSlot.Workspace} के इनबॉक्स में आज की सूची में जुड़ जाए।`,
  footer: `${EmailSlot.Time} पर भेजा गया क्योंकि todz सेटिंग में मुझे मेरा दिन ईमेल करें चालू है, जहाँ यह शुरू से चालू रहता है।`,
  stopLabel: 'ये ईमेल बंद करें',
};

export const DAY_EMAIL_COPY_HINDI: DayEmailCopy = {
  ...SHARED_COPY,
  subject: `आपका दिन: ${EmailSlot.Count} देय`,
  preview: `todz में आज ${EmailSlot.Count} देय। टास्क जोड़ने के लिए जवाब दें।`,
  heading: `आज ${EmailSlot.Count} देय`,
};

export const DAY_EMAIL_EMPTY_COPY_HINDI: DayEmailEmptyCopy = {
  ...SHARED_COPY,
  subject: 'आपका दिन: कुछ देय नहीं',
  preview: 'todz में आज कुछ देय नहीं। टास्क जोड़ने के लिए जवाब दें।',
  heading: 'आज कुछ देय नहीं',
};
