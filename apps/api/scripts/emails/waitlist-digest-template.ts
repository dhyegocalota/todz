import type { GeneratedEmail } from '../../src/emails/generated-email';

export async function generatedWaitlistDigestEmail(): Promise<GeneratedEmail> {
  return { subject: '', html: '', text: '' };
}

export async function generatedWaitlistDigestEmptyEmail(): Promise<GeneratedEmail> {
  return { subject: '', html: '', text: '' };
}
