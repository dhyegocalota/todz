import { Heading, Text } from '@react-email/components';
import { createElement, type ReactElement } from 'react';
import type { GeneratedEmail } from '../../src/emails/generated-email';
import { EmailLayout } from './email-layout';
import { EmailClassName, HEADING_STYLE, PARAGRAPH_STYLE } from './email-style';
import { renderEmail } from './render-email';
import { WELCOME_EMAIL_COPY } from './welcome-email-copy';

export function WelcomeTemplate(): ReactElement {
  return createElement(
    EmailLayout,
    { title: WELCOME_EMAIL_COPY.subject, preview: WELCOME_EMAIL_COPY.preview, footer: WELCOME_EMAIL_COPY.footer },
    createElement(Heading, { as: 'h1', className: EmailClassName.Text, style: HEADING_STYLE }, WELCOME_EMAIL_COPY.heading),
    createElement(Text, { className: EmailClassName.Text, style: PARAGRAPH_STYLE }, WELCOME_EMAIL_COPY.intro),
    createElement(Text, { className: EmailClassName.Text, style: PARAGRAPH_STYLE }, WELCOME_EMAIL_COPY.start),
    createElement(Text, { className: EmailClassName.Text, style: PARAGRAPH_STYLE }, WELCOME_EMAIL_COPY.signoff),
  );
}

export async function generatedWelcomeEmail(): Promise<GeneratedEmail> {
  const rendered = await renderEmail({ element: createElement(WelcomeTemplate) });
  return { subject: WELCOME_EMAIL_COPY.subject, ...rendered };
}
