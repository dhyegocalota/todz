import type { EmailSlot } from './email-slot';

export type GeneratedEmailPart = { html: string; text: string };
export type GeneratedEmail = GeneratedEmailPart & { subject: string };
export type EmailSlotValues = Partial<Record<EmailSlot, string>>;
