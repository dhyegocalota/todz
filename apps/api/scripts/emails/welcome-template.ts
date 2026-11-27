import type { Language } from '@todz/types';
import { Heading, Text } from 'react-email';
import { createElement, type ReactElement } from 'react';
import type { GeneratedEmail } from '../../src/emails/generated-email';
import { EmailLayout } from './email-layout';
import { EmailClassName, HEADING_STYLE, PARAGRAPH_STYLE } from './email-style';
import { renderEmail } from './render-email';
import type { WelcomeEmailCopy } from './welcome-email-copy';

type WelcomeTemplateInput = { copy: WelcomeEmailCopy; language: Language };

export function WelcomeTemplate({ copy, language }: WelcomeTemplateInput): ReactElement {
  return createElement(
    EmailLayout,
    { language, title: copy.subject, preview: copy.preview, footer: copy.footer },
    createElement(Heading, { as: 'h1', className: EmailClassName.Text, style: HEADING_STYLE }, copy.heading),
    createElement(Text, { className: EmailClassName.Text, style: PARAGRAPH_STYLE }, copy.intro),
    createElement(Text, { className: EmailClassName.Text, style: PARAGRAPH_STYLE }, copy.start),
    createElement(Text, { className: EmailClassName.Text, style: PARAGRAPH_STYLE }, copy.signoff),
  );
}

export async function generatedWelcomeEmail({ copy, language }: WelcomeTemplateInput): Promise<GeneratedEmail> {
  const rendered = await renderEmail({ element: createElement(WelcomeTemplate, { copy, language }) });
  return { subject: copy.subject, ...rendered };
}
