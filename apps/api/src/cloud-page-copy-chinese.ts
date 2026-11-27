import type { CloudPageCopy } from './cloud-page-copy';
export const CLOUD_PAGE_COPY_CHINESE: CloudPageCopy = {
  fullMail: {
    subject: 'todz cloud 目前已满',
    textOf: ({ queueUrl, selfHostUrl }: { queueUrl: string; selfHostUrl: string }): string =>
      `todz cloud 目前已满：免费的 todz cloud 名额极其有限。确认你的地址即可排队，有名额时你就能加入：${queueUrl}\n\n或者运行你自己的服务器，它永远开放：${selfHostUrl}`,
  },
  queuePage: {
    title: '为 todz cloud 排队',
    lead: '免费的 todz cloud 名额极其有限。请在下方确认，有名额时我们会写信通知你。',
    joinAs: '以此地址加入队列',
    invalidTitle: '此链接已失效',
    invalidBody: 'todz cloud 已满时我们发送的邮件中的链接一周内有效。请在 App 中重新申请登录链接，以获得新的链接。',
    submit: '排队',
    submitting: '正在发送…',
    queuedTitle: '你已在名单上',
    queuedBody: '有名额时，我们会给你发邮件。',
    tryAgain: '现在无法把你加入。请一分钟后再试。',
    closed: '队列目前已关闭。',
    forbidden: '该请求不是来自本网站。',
    selfHost: '或者运行你自己的服务器，它永远开放：',
    selfHostLink: '自行托管指南',
  },
};
