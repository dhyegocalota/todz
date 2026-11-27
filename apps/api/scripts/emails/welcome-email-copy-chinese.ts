import type { WelcomeEmailCopy } from './welcome-email-copy';
import { EmailSlot } from '../../src/emails/email-slot';

export const WELCOME_EMAIL_COPY_CHINESE: WelcomeEmailCopy = {
  subject: '欢迎使用 todz',
  preview: '你的 todz 账户已就绪',
  heading: '你已加入。欢迎使用 todz。',
  intro: `${EmailSlot.Email} 的 todz 账户已就绪。todz 是你和你的 AI 智能体共用的一份待办清单。`,
  start: '通过 MCP 连接一个智能体，让它添加你的第一个任务，或者自己从菜单栏添加一个。',
  signoff: '祝你交付顺利。',
  footer: `你收到这封邮件，是因为 ${EmailSlot.Email} 登录了 todz。`,
};
