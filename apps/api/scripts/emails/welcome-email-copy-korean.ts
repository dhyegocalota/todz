import type { WelcomeEmailCopy } from './welcome-email-copy';
import { EmailSlot } from '../../src/emails/email-slot';

export const WELCOME_EMAIL_COPY_KOREAN: WelcomeEmailCopy = {
  subject: 'todz에 오신 것을 환영해요',
  preview: 'todz 계정이 준비됐어요',
  heading: '가입 완료. todz에 오신 것을 환영해요.',
  intro: `${EmailSlot.Email}의 todz 계정이 준비됐어요. todz는 나와 AI 에이전트가 함께 쓰는 하나의 할 일 목록이에요.`,
  start: 'MCP로 에이전트를 연결해서 첫 작업을 추가해 달라고 부탁하거나, 메뉴 막대에서 직접 추가해 보세요.',
  signoff: '즐거운 출시 되세요.',
  footer: `${EmailSlot.Email}(으)로 todz에 로그인해서 이 메일을 받았어요.`,
};
