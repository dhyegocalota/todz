import type { WelcomeEmailCopy } from './welcome-email-copy';
import { EmailSlot } from '../../src/emails/email-slot';

export const WELCOME_EMAIL_COPY_JAPANESE: WelcomeEmailCopy = {
  subject: 'todzへようこそ',
  preview: 'todzのアカウントの準備ができました',
  heading: '準備完了です。todzへようこそ。',
  intro: `${EmailSlot.Email}のtodzアカウントの準備ができました。todzは、あなたとAIエージェントが共有する、1つのToDoリストです。`,
  start: 'MCP経由でエージェントを接続して、最初のタスクを追加してもらうか、メニューバーから自分で追加してみましょう。',
  signoff: 'よい出荷を。',
  footer: `${EmailSlot.Email}でtodzにサインインしたため、このメールをお送りしました。`,
};
