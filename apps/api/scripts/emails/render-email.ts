import { render, toPlainText } from '@react-email/render';
import type { ReactElement } from 'react';
import type { GeneratedEmailPart } from '../../src/emails/generated-email';
import { EmailClassName } from './email-style';

type PlainTextBuilder = { addInline(text: string): void };
type PlainTextElement = { children: unknown; attribs: Record<string, string> };

const STOP_LINK_FORMAT = 'stopLink';
const STOP_LINK_SEPARATOR = ': ';
const HREF_ATTRIBUTE = 'href';

function formatStopLink(
  element: PlainTextElement,
  walk: (children: unknown, builder: PlainTextBuilder) => void,
  builder: PlainTextBuilder,
): void {
  walk(element.children, builder);
  builder.addInline(`${STOP_LINK_SEPARATOR}${element.attribs[HREF_ATTRIBUTE]}`);
}

const PLAIN_TEXT_OPTIONS: Parameters<typeof toPlainText>[1] = {
  selectors: [
    { selector: 'h1', options: { uppercase: false } },
    { selector: `a.${EmailClassName.StopLink}`, format: STOP_LINK_FORMAT },
  ],
  formatters: { [STOP_LINK_FORMAT]: formatStopLink },
};

export async function renderEmail(input: { element: ReactElement }): Promise<GeneratedEmailPart> {
  const html = await render(input.element);
  return { html, text: toPlainText(html, PLAIN_TEXT_OPTIONS) };
}
