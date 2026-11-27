import type { WelcomeEmailCopy } from './welcome-email-copy';
import { EmailSlot } from '../../src/emails/email-slot';

export const WELCOME_EMAIL_COPY_HINDI: WelcomeEmailCopy = {
  subject: 'todz में आपका स्वागत है',
  preview: 'आपका todz खाता तैयार है',
  heading: 'आप अंदर हैं। todz में आपका स्वागत है।',
  intro: `${EmailSlot.Email} के लिए आपका todz खाता तैयार है। todz एक ऐसी टू-डू सूची है जिसे आप और आपके AI एजेंट साथ मिलकर इस्तेमाल करते हैं।`,
  start: 'MCP से किसी एजेंट को कनेक्ट करें और उससे अपना पहला टास्क जुड़वाएँ, या मेन्यू बार से खुद एक जोड़ें।',
  signoff: 'शिपिंग मुबारक।',
  footer: `आपको यह ईमेल इसलिए मिला क्योंकि ${EmailSlot.Email} ने todz में साइन इन किया।`,
};
