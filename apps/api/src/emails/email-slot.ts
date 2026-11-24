import type { EmailSlotValues } from './generated-email';

export enum EmailSlot {
  Link = '{{link}}',
  Email = '{{email}}',
  Origin = '{{origin}}',
}

export function filledTextOf(input: { text: string; values: EmailSlotValues }): string {
  throw new Error('filledTextOf is not implemented');
}

export function filledHtmlOf(input: { html: string; values: EmailSlotValues }): string {
  throw new Error('filledHtmlOf is not implemented');
}
