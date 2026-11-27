import type { WelcomeEmailCopy } from './welcome-email-copy';
import { EmailSlot } from '../../src/emails/email-slot';

export const WELCOME_EMAIL_COPY_ARABIC: WelcomeEmailCopy = {
  subject: 'مرحبًا بك في todz',
  preview: 'حسابك في todz جاهز',
  heading: 'أنت الآن معنا. مرحبًا بك في todz.',
  intro: `حسابك في todz لـ ${EmailSlot.Email} جاهز. todz قائمة مهام واحدة تتشاركها مع وكلاء الذكاء الاصطناعي.`,
  start: 'اربط وكيلًا عبر MCP واطلب منه إضافة مهمتك الأولى، أو أضف واحدة بنفسك من شريط القوائم.',
  signoff: 'عملًا موفقًا.',
  footer: `وصلتك هذه الرسالة لأن ${EmailSlot.Email} سجّل الدخول إلى todz.`,
};
