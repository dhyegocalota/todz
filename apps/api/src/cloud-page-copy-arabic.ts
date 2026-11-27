import type { CloudPageCopy } from './cloud-page-copy';
export const CLOUD_PAGE_COPY_ARABIC: CloudPageCopy = {
  fullMail: {
    subject: 'todz cloud ممتلئ حاليًا',
    textOf: ({ queueUrl, selfHostUrl }: { queueUrl: string; selfHostUrl: string }): string =>
      `todz cloud ممتلئ حاليًا: مقاعد todz cloud المجانية محدودة للغاية. أكّد عنوانك لتنضم إلى قائمة الانتظار، وستدخل عندما يُفتح مقعد: ${queueUrl}\n\nأو شغّل خادمك الخاص، وهو مفتوح دائمًا: ${selfHostUrl}`,
  },
  queuePage: {
    title: 'انضم إلى قائمة انتظار todz cloud',
    lead: 'مقاعد todz cloud المجانية محدودة للغاية. أكّد أدناه وسنراسلك عندما يُفتح مقعد.',
    joinAs: 'الانضمام إلى القائمة باسم',
    invalidTitle: 'هذا الرابط لم يعد صالحًا',
    invalidBody:
      'الرابط في الرسالة التي أرسلناها عندما كان todz cloud ممتلئًا يعمل أسبوعًا. اطلب رابط تسجيل دخول جديدًا في التطبيق للحصول على رابط جديد.',
    submit: 'انضم إلى القائمة',
    submitting: 'جارٍ الإرسال…',
    queuedTitle: 'أنت في القائمة',
    queuedBody: 'سنراسلك بالبريد عندما يُفتح مقعد.',
    tryAgain: 'تعذّرت إضافتك الآن. حاول مرة أخرى بعد دقيقة.',
    closed: 'القائمة مغلقة حاليًا.',
    forbidden: 'لم يأتِ هذا الطلب من هذا الموقع.',
    selfHost: 'أو شغّل خادمك الخاص، وهو مفتوح دائمًا:',
    selfHostLink: 'دليل الاستضافة الذاتية',
  },
};
