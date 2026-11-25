import type { GeneratedEmail } from '../../src/emails/generated-email';

export async function generatedAdminSignInEmail(): Promise<GeneratedEmail> {
  return { subject: '', html: '', text: '' };
}
