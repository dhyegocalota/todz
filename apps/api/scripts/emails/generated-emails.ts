export const GENERATED_EMAILS_PATH = new URL('../../src/emails/generated/email-templates.ts', import.meta.url).pathname;

export async function generatedEmailsSource(): Promise<string> {
  throw new Error('generatedEmailsSource is not implemented');
}
