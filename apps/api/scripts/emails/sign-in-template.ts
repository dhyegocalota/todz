import { Button, Heading, Link, Section, Text } from 'react-email';
import { createElement, type ReactElement } from 'react';
import { EmailSlot } from '../../src/emails/email-slot';
import type { GeneratedEmail } from '../../src/emails/generated-email';
import { EmailLayout } from './email-layout';
import { ACTION_STYLE, BUTTON_STYLE, EmailClassName, HEADING_STYLE, LINK_STYLE, MUTED_STYLE, PARAGRAPH_STYLE } from './email-style';
import { renderEmail } from './render-email';
import { SIGN_IN_EMAIL_COPY } from './sign-in-email-copy';

export function SignInTemplate(): ReactElement {
  return createElement(
    EmailLayout,
    { title: SIGN_IN_EMAIL_COPY.subject, preview: SIGN_IN_EMAIL_COPY.preview, footer: SIGN_IN_EMAIL_COPY.footer },
    createElement(Heading, { as: 'h1', className: EmailClassName.Text, style: HEADING_STYLE }, SIGN_IN_EMAIL_COPY.heading),
    createElement(Text, { className: EmailClassName.Text, style: PARAGRAPH_STYLE }, SIGN_IN_EMAIL_COPY.intro),
    createElement(
      Section,
      { style: ACTION_STYLE },
      createElement(Button, { href: EmailSlot.Link, style: BUTTON_STYLE }, SIGN_IN_EMAIL_COPY.action),
    ),
    createElement(Text, { className: EmailClassName.Muted, style: MUTED_STYLE }, SIGN_IN_EMAIL_COPY.fallback),
    createElement(
      Text,
      { style: MUTED_STYLE },
      createElement(Link, { href: EmailSlot.Link, className: EmailClassName.Link, style: LINK_STYLE }, EmailSlot.Link),
    ),
  );
}

export async function generatedSignInEmail(): Promise<GeneratedEmail> {
  const rendered = await renderEmail({ element: createElement(SignInTemplate) });
  return { subject: SIGN_IN_EMAIL_COPY.subject, ...rendered };
}
