import { Heading, Text } from 'react-email';
import { createElement, type ReactElement } from 'react';
import type { GeneratedEmail } from '../../src/emails/generated-email';
import { EmailLayout } from './email-layout';
import { EmailClassName, HEADING_STYLE, PARAGRAPH_STYLE } from './email-style';
import { renderEmail } from './render-email';
import { WAITLIST_EMAIL_COPY } from './waitlist-email-copy';

export function WaitlistTemplate(): ReactElement {
  return createElement(
    EmailLayout,
    { title: WAITLIST_EMAIL_COPY.subject, preview: WAITLIST_EMAIL_COPY.preview, footer: WAITLIST_EMAIL_COPY.footer },
    createElement(Heading, { as: 'h1', className: EmailClassName.Text, style: HEADING_STYLE }, WAITLIST_EMAIL_COPY.heading),
    createElement(Text, { className: EmailClassName.Text, style: PARAGRAPH_STYLE }, WAITLIST_EMAIL_COPY.intro),
  );
}

export async function generatedWaitlistEmail(): Promise<GeneratedEmail> {
  const rendered = await renderEmail({ element: createElement(WaitlistTemplate) });
  return { subject: WAITLIST_EMAIL_COPY.subject, ...rendered };
}
