export enum EmailSlot {
  Link = '{{link}}',
  Email = '{{email}}',
  Origin = '{{origin}}',
}

export type EmailSlotValues = Partial<Record<EmailSlot, string>>;

const SLOT_PATTERN_SPECIAL_CHARACTERS = /[{}]/g;
const SLOT_PATTERN = new RegExp(
  Object.values(EmailSlot)
    .map((slot) => slot.replace(SLOT_PATTERN_SPECIAL_CHARACTERS, '\\$&'))
    .join('|'),
  'g',
);
const HTML_ESCAPES: [string, string][] = [
  ['&', '&amp;'],
  ['<', '&lt;'],
  ['>', '&gt;'],
  ['"', '&quot;'],
  ["'", '&#39;'],
];

function escapedHtmlOf(value: string): string {
  return HTML_ESCAPES.reduce((escaped, [character, entity]) => escaped.replaceAll(character, entity), value);
}

function filledOf(input: { template: string; values: EmailSlotValues }): string {
  return input.template.replace(SLOT_PATTERN, (slot) => {
    const value = input.values[slot as EmailSlot];
    if (value === undefined) return slot;
    return value;
  });
}

export function filledTextOf(input: { text: string; values: EmailSlotValues }): string {
  return filledOf({ template: input.text, values: input.values });
}

export function filledHtmlOf(input: { html: string; values: EmailSlotValues }): string {
  const escapedValues = Object.fromEntries(Object.entries(input.values).map(([slot, value]) => [slot, escapedHtmlOf(value)]));
  return filledOf({ template: input.html, values: escapedValues });
}
