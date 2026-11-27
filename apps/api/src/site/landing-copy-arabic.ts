import type { LandingCopy } from './landing-copy';
import { formatShortId } from '@todz/core';
import { AUTHOR, COMPANY } from '@todz/types';
import { MCP_COPY, McpToolName } from '../mcp-copy';
import { AgentClient, agentSetupOf } from './agent-setup';
import { MCP_URL } from './site-urls';

const EXAMPLE_TASK_NUMBER = 12;
const EXAMPLE_TASK_TITLE = 'مراجعة PR';
const EXAMPLE_SECOND_TASK_TITLE = 'إطلاق النسخة التجريبية';
const EXAMPLE_DUE_COUNT = 3;
const SERVER_DEPLOY_SCRIPT = 'server:deploy';

export const LANDING_COPY_ARABIC: LandingCopy = {
  meta: {
    siteName: 'todz',
    title: 'todz: مهامك يتشاركها وكلاؤك',
    description: 'قائمة مهام أصلية لـ Mac يعمل عليها Claude Code وCodex وCursor عبر MCP. شريط القوائم والويدجت والمزامنة دون اتصال.',
  },
  shell: {
    skipLink: 'انتقل إلى المحتوى',
    homeLabel: 'الصفحة الرئيسية لـ todz',
    wordmark: 'todz',
    navLabel: 'الموقع',
    selfHostLink: 'دليل الاستضافة الذاتية',
    selfHostLinkShort: 'الاستضافة الذاتية',
    installLink: 'التثبيت على Mac',
    installLinkShort: 'التثبيت',
    githubLabel: 'todz على GitHub',
    footerSelfHost: 'دليل الاستضافة الذاتية',
    footerInstall: 'التثبيت على Mac',
    footerGithub: 'GitHub',
    languageLabel: 'اللغة',
    themeLabel: 'المظهر',
    themeSystem: 'النظام',
    themeLight: 'فاتح',
    themeDark: 'داكن',
    creditPrefix: '© todz ·',
    creditLead: 'todz منتج من',
    creditName: COMPANY.tradeName,
    creditTail: '، صُنع في البرازيل',
  },
  hero: {
    eyebrow: 'macOS 14 أو أحدث',
    title: 'مهامك، يتشاركها وكلاؤك.',
    lead: 'قائمة مهام أصلية لـ Mac يعمل عليها Claude Code وCodex وCursor عبر MCP.',
  },
  download: {
    button: 'تنزيل لـ Mac',
    heroButton: 'تنزيل لـ Mac — مجانًا',
    note: 'لم يوثّقه Apple بعد: في المرة الأولى، افتحه من إعدادات النظام › الخصوصية والأمان.',
    noteLink: 'خطوات التثبيت',
  },
  free: {
    line: 'مجاني مع todz cloud أو شغّل خادمك الخاص.',
    linkText: 'شغّل خادمك الخاص',
  },
  ways: {
    cloud: {
      title: 'todz cloud',
      badge: 'مجاني',
      points: ['سجّل الدخول ببريدك الإلكتروني.', 'متزامن بين أجهزة Mac ووكلائك.', 'لا شيء لتشغيله.'],
      limit: 'مقاعد todz cloud المجانية محدودة للغاية. الاستضافة الذاتية مفتوحة دائمًا.',
      cta: 'تنزيل لـ Mac',
    },
    selfHost: {
      title: 'الاستضافة الذاتية',
      badge: 'مفتوح المصدر',
      body: 'شغّل الخادم على حساب Cloudflare الخاص بك. التطبيق نفسه، وتبدّل الخادم من الإعدادات.',
      cta: 'دليل إعداد الخادم',
      terminal: {
        label: 'خطوة النشر في دليل الاستضافة الذاتية',
        command: `pnpm --filter @todz/api ${SERVER_DEPLOY_SCRIPT}`,
        ready: 'todz server ready: https://api.example.com',
        next: '→ paste it in todz › Settings › Server',
      },
    },
    note: 'التطبيق هو نفسه في الحالتين، ويحدّث نفسه.',
  },
  openSource: {
    starLabel: 'ضع نجمة على GitHub',
    license: 'الترخيص',
    contributing: 'المساهمة',
  },
  signature: {
    line: 'بناه مطوّر، للمطوّرين والمولعين بالذكاء الاصطناعي.',
    name: AUTHOR.name,
  },
  stage: {
    label: 'تطبيق todz على سطح مكتب Mac',
    menuCount: '2',
  },
  benefits: {
    heading: 'لماذا todz',
    day: {
      eyebrow: 'يأتي إليك',
      title: 'todz لا ينتظر أن يُفتح.',
      railLabel: 'يوم مع todz، من 07:00 إلى 18:00',
      email: {
        time: '07:00',
        subject: `يومك: يستحق ${EXAMPLE_DUE_COUNT}`,
        title: 'يومك، بالبريد',
        body: 'ردّ لإضافة مهمة.',
      },
      glance: {
        time: '09:00',
        heading: 'اليوم',
        count: `المتبقي ${EXAMPLE_DUE_COUNT}`,
        rows: [EXAMPLE_TASK_TITLE, EXAMPLE_SECOND_TASK_TITLE],
        title: 'نظرة الصباح',
        body: 'عند تنبيه Mac يظهر اليوم لبضع ثوانٍ.',
      },
      agent: {
        time: '10:30',
        ask: 'في todz ما التالي؟',
        toolCall: `todz - ${McpToolName.Next} (MCP)`,
        toolResult: MCP_COPY.agentNudge.line({
          summary: MCP_COPY.agentNudge.due(EXAMPLE_DUE_COUNT),
          taskId: formatShortId(EXAMPLE_TASK_NUMBER),
        }),
        title: 'وكلاؤك يعرفون',
        body: 'اسألهم عمّا هو تالٍ: يبدؤون باليوم.',
      },
      close: {
        time: '18:00',
        count: `المتبقي ${EXAMPLE_DUE_COUNT}`,
        task: `${formatShortId(EXAMPLE_TASK_NUMBER)} ${EXAMPLE_TASK_TITLE}`,
        actions: ['منجزة', 'غدًا', 'بلا تاريخ'],
        title: 'إغلاق اليوم',
        body: 'لكل مهمة: منجزة أو غدًا أو بلا تاريخ.',
      },
      extras: {
        label: 'وأيضًا على جهاز Mac',
        ribbon: {
          label: 'الشريط في شريط القوائم',
          detail: `المتبقي ${EXAMPLE_DUE_COUNT} · التالية: ${formatShortId(EXAMPLE_TASK_NUMBER)} ${EXAMPLE_TASK_TITLE}`,
        },
        temperature: { label: 'حرارة اليوم', detail: 'يخفت العدّاد بعد الظهر.' },
        siri: { label: 'Siri', detail: '«ما المتبقي اليوم في ⁦todz⁩؟»' },
      },
      note: 'كل واحدة عدا Siri مفتاح في الإعدادات. احترام التركيز يُبقي Mac هادئًا أثناء وضع التركيز.',
    },
    agents: {
      title: 'الوكلاء يضيفون المهام عبر MCP',
      body: 'يقرأ Claude Code وCodex وCursor مهامك ويضيفونها وينجزونها. وكل تغيير يذكر من أجراه.',
    },
    offline: {
      title: 'يعمل دون اتصال، ويزامن في كل مكان',
      body: 'تنتظر التغييرات وأنت دون اتصال، وتصل إلى كل Mac لحظة عودتك.',
    },
    lock: {
      title: 'مساحات عمل تضع الخصوصية أولًا',
      body: 'تبقى كل مساحة عمل منفصلة على شاشتك وفي ويدجتك. ويحرس Touch ID كل تبديل.',
    },
  },
  howItWorks: {
    eyebrow: 'كيف يعمل',
    title: 'اربط مرة واحدة. واسأل بكلمات بسيطة.',
    step1: 'أضف الخادم: أمر واحد، ثم سجّل الدخول.',
    step2: 'اطلب من وكيلك إضافة مهمة أو سردها أو إنجازها.',
    step3: 'تظهر في شريط القوائم والويدجت.',
  },
  terminal: {
    label: 'إضافة todz إلى Claude Code ثم إضافة مهمة',
    shellPrompt: '$',
    command: agentSetupOf({ client: AgentClient.ClaudeCode, serverUrl: MCP_URL }),
    askPrompt: '>',
    ask: 'أضف مهمة في todz لمراجعة PR',
    toolCall: `todz - ${McpToolName.Add} (MCP)(tasks: [{"title": "${EXAMPLE_TASK_TITLE}"}])`,
    toolResult: `${MCP_COPY.added} ${formatShortId(EXAMPLE_TASK_NUMBER)} ${EXAMPLE_TASK_TITLE}`,
  },
  final: {
    title: 'احصل على todz على Mac.',
  },
  alt: {
    window: 'النافذة الرئيسية لـ todz: مهام مشروع، إحداها أُضيفت عبر Claude Code، مع ملاحظاتها وسجلها في المفتّش',
    windowDark: 'النافذة الرئيسية لـ todz في الوضع الداكن: ثلاث مهام أُضيفت عبر Claude Code',
    popover: 'النافذة المنبثقة لـ todz في شريط القوائم: مهام اليوم وحقل أضف مهمة',
    widgetMedium: 'ويدجت اليوم المتوسطة مع ثلاث مهام مفتوحة',
    agentTasks: 'مهام مشروع في todz، وأحدثها أُضيفت عبر Claude Code',
    workspaceLock: 'الشريط الجانبي في todz يعرض مساحة العمل الحالية وقوائمها فقط',
  },
};
