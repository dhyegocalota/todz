import type { LandingCopy } from './landing-copy';
import { formatShortId } from '@todz/core';
import { AUTHOR, COMPANY } from '@todz/types';
import { MCP_COPY, McpToolName } from '../mcp-copy';
import { AgentClient, agentSetupOf } from './agent-setup';
import { MCP_URL } from './site-urls';

const EXAMPLE_TASK_NUMBER = 12;
const EXAMPLE_TASK_TITLE = 'PR की समीक्षा करें';
const EXAMPLE_SECOND_TASK_TITLE = 'बीटा शिप करें';
const EXAMPLE_DUE_COUNT = 3;
const SERVER_DEPLOY_SCRIPT = 'server:deploy';

export const LANDING_COPY_HINDI: LandingCopy = {
  meta: {
    siteName: 'todz',
    title: 'todz: आपके टास्क, आपके एजेंटों के साथ साझा',
    description: 'Mac की एक नेटिव टू-डू सूची, जिस पर Claude Code, Codex और Cursor MCP से काम करते हैं। मेन्यू बार, विजेट, ऑफ़लाइन सिंक।',
  },
  shell: {
    skipLink: 'सीधे कंटेंट पर जाएँ',
    homeLabel: 'todz होम',
    wordmark: 'todz',
    navLabel: 'साइट',
    selfHostLink: 'सेल्फ़-होस्ट गाइड',
    selfHostLinkShort: 'सेल्फ़-होस्ट',
    installLink: 'Mac पर इंस्टॉल करें',
    installLinkShort: 'इंस्टॉल',
    githubLabel: 'GitHub पर todz',
    footerSelfHost: 'सेल्फ़-होस्ट गाइड',
    footerInstall: 'Mac पर इंस्टॉल करें',
    footerGithub: 'GitHub',
    languageLabel: 'भाषा',
    themeLabel: 'थीम',
    themeSystem: 'सिस्टम',
    themeLight: 'लाइट',
    themeDark: 'डार्क',
    creditPrefix: '© todz ·',
    creditLead: 'todz,',
    creditName: COMPANY.tradeName,
    creditTail: ' का उत्पाद है, ब्राज़ील में बना।',
  },
  hero: {
    eyebrow: 'macOS 14 या बाद का',
    title: 'आपके टास्क, आपके एजेंटों के साथ साझा।',
    lead: 'Mac की एक नेटिव टू-डू सूची, जिस पर Claude Code, Codex और Cursor MCP से काम करते हैं।',
  },
  download: {
    button: 'Mac के लिए डाउनलोड करें',
    heroButton: 'Mac के लिए डाउनलोड करें — मुफ़्त',
    note: 'अभी Apple द्वारा नोटराइज़ नहीं किया गया: पहली बार इसे सिस्टम सेटिंग › गोपनीयता और सुरक्षा से खोलें।',
    noteLink: 'इंस्टॉल के चरण',
  },
  free: {
    line: 'todz cloud पर मुफ़्त — या अपना चलाएँ।',
    linkText: 'अपना चलाएँ',
  },
  ways: {
    cloud: {
      title: 'todz cloud',
      badge: 'मुफ़्त',
      points: ['अपने ईमेल से साइन इन करें।', 'आपके Mac और एजेंटों में सिंक।', 'कुछ चलाना नहीं।'],
      limit: 'todz cloud की मुफ़्त जगहें बेहद सीमित हैं। सेल्फ़-होस्टिंग हमेशा खुली है।',
      cta: 'Mac के लिए डाउनलोड करें',
    },
    selfHost: {
      title: 'सेल्फ़-होस्ट',
      badge: 'ओपन सोर्स',
      body: 'सर्वर को अपने Cloudflare खाते पर चलाएँ। वही ऐप: सेटिंग में सर्वर बदल लें।',
      cta: 'सर्वर सेटअप गाइड',
      terminal: {
        label: 'सेल्फ़-होस्ट गाइड का डिप्लॉय चरण',
        command: `pnpm --filter @todz/api ${SERVER_DEPLOY_SCRIPT}`,
        ready: 'todz server ready: https://api.example.com',
        next: '→ इसे todz › सेटिंग › सर्वर में पेस्ट करें',
      },
    },
    note: 'ऐप दोनों तरह एक ही है, और खुद को अपडेट करता है।',
  },
  openSource: {
    starLabel: 'GitHub पर स्टार करें',
    license: 'लाइसेंस',
    contributing: 'योगदान',
  },
  signature: {
    line: 'एक डेवलपर ने बनाया, डेवलपरों और AI के शौकीनों के लिए।',
    name: AUTHOR.name,
  },
  stage: {
    label: 'Mac डेस्कटॉप पर todz ऐप',
    menuCount: '2',
  },
  benefits: {
    heading: 'todz क्यों',
    day: {
      eyebrow: 'यह खुद आपके पास आता है',
      title: 'todz के खुलने का इंतज़ार नहीं करता।',
      railLabel: 'todz के साथ एक दिन, 07:00 से 18:00 तक',
      email: {
        time: '07:00',
        subject: `आपका दिन: ${EXAMPLE_DUE_COUNT} देय`,
        title: 'आपका दिन, ईमेल से',
        body: 'टास्क जोड़ने के लिए जवाब दें।',
      },
      glance: {
        time: '09:00',
        heading: 'आज',
        count: `${EXAMPLE_DUE_COUNT} बाकी`,
        rows: [EXAMPLE_TASK_TITLE, EXAMPLE_SECOND_TASK_TITLE],
        title: 'सुबह की झलक',
        body: 'अपना Mac जगाएँ: आज की सूची कुछ सेकंड के लिए दिखती है।',
      },
      agent: {
        time: '10:30',
        ask: 'todz में अगला क्या है?',
        toolCall: `todz - ${McpToolName.Next} (MCP)`,
        toolResult: MCP_COPY.agentNudge.line({
          summary: MCP_COPY.agentNudge.due(EXAMPLE_DUE_COUNT),
          taskId: formatShortId(EXAMPLE_TASK_NUMBER),
        }),
        title: 'आपके एजेंट जानते हैं',
        body: 'पूछें कि अगला क्या है: वे आज से शुरू करते हैं।',
      },
      close: {
        time: '18:00',
        count: `${EXAMPLE_DUE_COUNT} बाकी`,
        task: `${formatShortId(EXAMPLE_TASK_NUMBER)} ${EXAMPLE_TASK_TITLE}`,
        actions: ['पूरा', 'कल', 'कोई तारीख़ नहीं'],
        title: 'दिन समाप्त करें',
        body: 'हर टास्क: पूरा, कल या कोई तारीख़ नहीं।',
      },
      extras: {
        label: 'आपके Mac पर और भी',
        ribbon: {
          label: 'मेन्यू बार रिबन',
          detail: `${EXAMPLE_DUE_COUNT} बाकी · अगला: ${formatShortId(EXAMPLE_TASK_NUMBER)} ${EXAMPLE_TASK_TITLE}`,
        },
        temperature: { label: 'दिन का तापमान', detail: 'दोपहर के बाद गिनती धुँधली पड़ती है।' },
        siri: { label: 'Siri', detail: '“todz में आज क्या बाकी है?”' },
      },
      note: 'Siri को छोड़कर हर एक सेटिंग में एक स्विच है। फ़ोकस का सम्मान करें फ़ोकस के दौरान आपके Mac को शांत रखता है।',
    },
    agents: {
      title: 'एजेंट MCP से टास्क जोड़ते हैं',
      body: 'Claude Code, Codex और Cursor आपके टास्क पढ़ते, जोड़ते और पूरे करते हैं। हर बदलाव बताता है कि किसने किया।',
    },
    offline: {
      title: 'ऑफ़लाइन चलता है, हर जगह सिंक होता है',
      body: 'ऑफ़लाइन रहते बदलाव इंतज़ार करते हैं और आपके लौटते ही हर Mac पर पहुँच जाते हैं।',
    },
    lock: {
      title: 'गोपनीयता-पहले वर्कस्पेस',
      body: 'हर वर्कस्पेस आपकी स्क्रीन और विजेट में अलग रहता है। हर बदलाव पर Touch ID पहरा देता है।',
    },
  },
  howItWorks: {
    eyebrow: 'यह कैसे काम करता है',
    title: 'एक बार कनेक्ट करें। सादे शब्दों में कहें।',
    step1: 'सर्वर जोड़ें: एक कमांड, फिर साइन इन।',
    step2: 'अपने एजेंट से टास्क जोड़ने, सूचीबद्ध करने या पूरा करने को कहें।',
    step3: 'वह आपके मेन्यू बार और विजेट में दिखता है।',
  },
  terminal: {
    label: 'Claude Code में todz जोड़ना, फिर एक टास्क जोड़ना',
    shellPrompt: '$',
    command: agentSetupOf({ client: AgentClient.ClaudeCode, serverUrl: MCP_URL }),
    askPrompt: '>',
    ask: 'todz में एक टास्क जोड़ो: PR की समीक्षा करो',
    toolCall: `todz - ${McpToolName.Add} (MCP)(tasks: [{"title": "${EXAMPLE_TASK_TITLE}"}])`,
    toolResult: `${MCP_COPY.added} ${formatShortId(EXAMPLE_TASK_NUMBER)} ${EXAMPLE_TASK_TITLE}`,
  },
  final: {
    title: 'todz को अपने Mac पर पाएँ।',
  },
  alt: {
    window: 'todz की मुख्य विंडो: एक प्रोजेक्ट के टास्क, एक Claude Code से जोड़ा गया, इंस्पेक्टर में उसके नोट्स और इतिहास के साथ',
    windowDark: 'डार्क मोड में todz की मुख्य विंडो: Claude Code से जोड़े गए तीन टास्क',
    popover: 'todz का मेन्यू बार पॉपओवर: आज के टास्क और टास्क जोड़ें फ़ील्ड',
    widgetMedium: 'तीन खुले टास्क वाला मध्यम आज विजेट',
    agentTasks: 'todz में एक प्रोजेक्ट के टास्क, सबसे नया Claude Code से जोड़ा गया',
    workspaceLock: 'todz का साइडबार, जो सिर्फ़ मौजूदा वर्कस्पेस और उसकी सूचियाँ दिखाता है',
  },
};
