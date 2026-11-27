import { EMAIL_CODE_SECONDS_SLOT, type EmailCodeCopy } from './email-code-copy';
export const EMAIL_CODE_COPY_HINDI: EmailCodeCopy = {
  label: 'साइन-इन कोड',
  lead: 'या उसी ईमेल से 6 अंकों का कोड डालें।',
  submit: 'साइन इन करें',
  submitting: 'साइन इन हो रहा है…',
  wrong: 'यह कोड काम नहीं आया। इसे जाँचें और फिर से कोशिश करें।',
  locked: 'बहुत ज़्यादा कोशिशें। ईमेल का लिंक इस्तेमाल करें या नया कोड माँगें।',
  resend: 'कोड फिर से भेजें',
  resendWait: `${EMAIL_CODE_SECONDS_SLOT} सेकंड में कोड फिर से भेजें`,
  resending: 'भेजा जा रहा है…',
};
