import type { AdminSignInEmailCopy } from './admin-sign-in-email-copy';
import { ADMIN_SIGN_IN_LINK_LIFETIME_MINUTES } from '../../src/site/admin-paths';

export const ADMIN_SIGN_IN_EMAIL_COPY_KOREAN: AdminSignInEmailCopy = {
  subject: 'todz 관리자 로그인',
  preview: 'todz 관리자로 가는 링크예요. 한 번만 쓸 수 있어요.',
  heading: '관리자에 로그인',
  intro: '버튼을 눌러 todz 관리자에 로그인하세요.',
  action: '로그인',
  fallback: '엉뚱한 브라우저에서 열리나요? 요청한 브라우저에 이 링크를 붙여 넣으세요:',
  footer: `이 링크는 요청한 브라우저에서 ${ADMIN_SIGN_IN_LINK_LIFETIME_MINUTES}분 동안, 한 번만 쓸 수 있어요.`,
  codeLabel: '또는 링크를 요청한 화면에 이 코드를 입력하세요. 한 번만 쓸 수 있고 링크와 함께 만료돼요.',
};
