import type { CloudPageCopy } from './cloud-page-copy';
export const CLOUD_PAGE_COPY_HINDI: CloudPageCopy = {
  fullMail: {
    subject: 'todz cloud अभी भरा हुआ है',
    textOf: ({ queueUrl, selfHostUrl }: { queueUrl: string; selfHostUrl: string }): string =>
      `todz cloud अभी भरा हुआ है: todz cloud की मुफ़्त जगहें बेहद सीमित हैं। कतार में आने के लिए अपने पते की पुष्टि करें, और जगह खुलते ही आपको प्रवेश मिल जाएगा: ${queueUrl}\n\nया अपना सर्वर चलाएँ, जो हमेशा खुला है: ${selfHostUrl}`,
  },
  queuePage: {
    title: 'todz cloud की कतार में आएँ',
    lead: 'todz cloud की मुफ़्त जगहें बेहद सीमित हैं। नीचे पुष्टि करें, और जब कोई जगह खुलेगी तो हम आपको लिखेंगे।',
    joinAs: 'इस रूप में कतार में शामिल हों',
    invalidTitle: 'यह लिंक अब मान्य नहीं है',
    invalidBody: 'todz cloud भरा होने पर हमने जो मेल भेजा था, उसका लिंक एक हफ़्ते चलता है। नया पाने के लिए ऐप में नया साइन-इन लिंक माँगें।',
    submit: 'कतार में आएँ',
    submitting: 'भेजा जा रहा है…',
    queuedTitle: 'आप सूची में हैं',
    queuedBody: 'जगह खुलते ही हम आपको ईमेल करेंगे।',
    tryAgain: 'अभी आपको जोड़ा नहीं जा सका। एक मिनट में दोबारा कोशिश करें।',
    closed: 'कतार अभी बंद है।',
    forbidden: 'वह अनुरोध इस साइट से नहीं आया।',
    selfHost: 'या अपना सर्वर चलाएँ, जो हमेशा खुला है:',
    selfHostLink: 'सेल्फ़-होस्ट गाइड',
  },
};
