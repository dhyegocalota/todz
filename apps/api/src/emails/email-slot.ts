import { escapedHtml } from '../escaped-html';

export enum EmailSlot {
  Link = '{{link}}',
  Email = '{{email}}',
  Origin = '{{origin}}',
  More = '{{more}}',
  Count = '{{count}}',
  Tasks = '{{tasks}}',
  Workspace = '{{workspace}}',
  Time = '{{time}}',
  StopUrl = '{{stopUrl}}',
}

export type EmailSlotValues = Partial<Record<EmailSlot, string>>;

const SLOT_PATTERN_SPECIAL_CHARACTERS = /[{}]/g;
const SLOT_PATTERN = new RegExp(
  Object.values(EmailSlot)
    .map((slot) => slot.replace(SLOT_PATTERN_SPECIAL_CHARACTERS, '\\$&'))
    .join('|'),
  'g',
);
function filledOf(input: { template: string; values: EmailSlotValues }): string {
  return input.template.replace(SLOT_PATTERN, (slot) => {
    const value = input.values[slot as EmailSlot];
    if (value === undefined) throw new Error(`no value for ${slot}`);
    return value;
  });
}

export function filledTextOf(input: { text: string; values: EmailSlotValues }): string {
  return filledOf({ template: input.text, values: input.values });
}

export function filledHtmlOf(input: { html: string; values: EmailSlotValues }): string {
  const escapedValues = Object.fromEntries(Object.entries(input.values).map(([slot, value]) => [slot, escapedHtml(value)]));
  return filledOf({ template: input.html, values: escapedValues });
}
