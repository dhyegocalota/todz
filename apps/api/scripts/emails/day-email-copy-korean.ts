import type { DayEmailCopy, DayEmailEmptyCopy } from './day-email-copy';
import { EmailSlot } from '../../src/emails/email-slot';

const SHARED_COPY = {
  replyHint: `로그인에 쓰는 주소로 한 줄만 답장하면 ${EmailSlot.Workspace}의 Inbox에 있는 오늘 목록에 추가돼요.`,
  footer: `todz 설정에서 내 하루를 이메일로 받기가 켜져 있어서 ${EmailSlot.Time}에 보냈어요. 이 설정은 처음에 켜진 상태로 시작해요.`,
  stopLabel: '이 메일 그만 받기',
};

export const DAY_EMAIL_COPY_KOREAN: DayEmailCopy = {
  ...SHARED_COPY,
  subject: `내 하루: ${EmailSlot.Count}개 마감`,
  preview: `todz에서 오늘 마감인 작업이 ${EmailSlot.Count}개예요. 답장하면 작업이 추가돼요.`,
  heading: `오늘 마감 ${EmailSlot.Count}개`,
};

export const DAY_EMAIL_EMPTY_COPY_KOREAN: DayEmailEmptyCopy = {
  ...SHARED_COPY,
  subject: '내 하루: 마감 없음',
  preview: 'todz에서 오늘 마감인 작업이 없어요. 답장하면 작업이 추가돼요.',
  heading: '오늘 마감인 작업이 없어요',
};
