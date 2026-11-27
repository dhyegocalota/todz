import type { OAuthCopy } from './oauth-copy';
export const OAUTH_COPY_ARABIC: OAuthCopy = {
  meta: {
    description: 'اربط تطبيقًا بحساب todz الخاص بك.',
    signInTitle: 'ربط تطبيق · todz',
    inboxTitle: 'تحقق من بريدك الوارد · todz',
    consentTitle: 'الموافقة على تطبيق · todz',
    refusedTitle: 'تعذّر الربط · todz',
    linkTitle: 'جارٍ تسجيل الدخول · todz',
    returnTitle: 'العودة إلى التطبيق · todz',
    approvedTitle: 'تمت الموافقة مسبقًا · todz',
  },
  signIn: {
    titleOf: (clientName: string) => `سجّل الدخول لربط ${clientName}`,
    lead: 'أدخل عنوان حسابك في todz. يصلك رابط بالبريد، ويُفتح في هذا المتصفح.',
    emailLabel: 'عنوان البريد الإلكتروني',
    emailPlaceholder: 'you@example.com',
    submit: 'أرسل لي رابطًا بالبريد',
    submitting: 'جارٍ الإرسال…',
    invalidAddress: 'أدخل عنوان بريد إلكتروني صالحًا.',
    tooMany: 'تعذّر إرسال رابط الآن. حاول مرة أخرى بعد دقيقة.',
    unavailable: 'تسجيل الدخول لربط التطبيقات غير متاح على هذا الخادم.',
  },
  inbox: {
    title: 'تحقق من بريدك الوارد',
    body: 'إذا كان بإمكان هذا العنوان تسجيل الدخول، فالرابط في الطريق. يعمل مرة واحدة، في هذا المتصفح، ويعيدك إلى هنا.',
  },
  consent: {
    titleOf: (clientName: string) => `ربط ${clientName} بـ todz؟`,
    redirectOf: (host: string) => `بعد أن تجيب، يعيدك todz إلى ${host}.`,
    loopbackRedirectOf: (host: string) => `بعد أن تجيب، يعيدك todz إلى ${host}، وهو تطبيق على هذا الكمبيوتر.`,
    legend: 'إلى ماذا يمكنه الوصول؟',
    projectHint: 'المشروع يتيح له قراءة مهام ذلك المشروع وتغييرها، ونقلها إلى المشاريع الأخرى في مساحة عمله.',
    ownerLabel: 'حسابك كله (نطاق المالك)',
    ownerWarning: 'يمكنه قراءة كل مهمة وتغييرها، وإنشاء كل مساحة عمل ومشروع وإعادة تسميته وحذفه.',
    noProjects: 'ليس لديك مشاريع بعد. أنشئ واحدًا في تطبيق todz، ثم عد إلى هنا.',
    approve: 'موافقة',
    approving: 'جارٍ الموافقة…',
    deny: 'رفض',
  },
  return: {
    titleOf: (clientName: string) => `جارٍ إعادتك إلى ${clientName}`,
    body: 'إذا لم يُفتح من تلقاء نفسه، فاستخدم الرابط.',
    actionOf: (clientName: string) => `العودة إلى ${clientName}`,
  },
  approved: {
    title: 'تمت الموافقة مسبقًا',
    bodyOf: (clientName: string) =>
      `تمت الموافقة على هذا الطلب بالفعل. عد إلى ${clientName} لإكمال الربط. وإذا ما زال يسأل، فابدأ من جديد من ${clientName}.`,
  },
  refusal: {
    invalidTitle: 'لا يمكن استخدام هذا الرابط لربط تطبيق',
    invalidBody:
      'ابدأ من جديد من التطبيق الذي تربطه. وإذا ظل يصل إلى هنا، فامسح أولًا تسجيل الدخول المحفوظ فيه (في Claude Code: /mcp، ثم Clear authentication).',
    choiceTitle: 'هذا الخيار غير متاح',
    choiceBody: 'ابدأ من جديد من التطبيق الذي تربطه واختر أحد الخيارات المعروضة.',
    forbiddenTitle: 'رُفض الطلب',
    forbiddenBody: 'لم يأتِ هذا الطلب من هذه الصفحة. ابدأ من جديد من التطبيق الذي تربطه.',
  },
  link: {
    working: 'جارٍ تسجيل دخولك…',
    failedTitle: 'لا يمكن استخدام هذا الرابط.',
    failedBody: 'اطلب رابطًا جديدًا من هذا المتصفح.',
    failedAction: 'احصل على رابط جديد',
    cloudFullTitle: 'todz cloud ممتلئ حاليًا',
    cloudFullBodyOf: ({ selfHostUrl }: { selfHostUrl: string }) =>
      `todz cloud ممتلئ حاليًا. اترك بريدك وستدخل عندما يُفتح مقعد، أو شغّل خادمك الخاص: ${selfHostUrl}`,
    noScriptTitle: 'أكمل تسجيل الدخول',
    noScript: 'تحتاج هذه الصفحة إلى JavaScript لإكمال تسجيل دخولك. فعّله، ثم افتح الرابط مرة أخرى.',
  },
};
